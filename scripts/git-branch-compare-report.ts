import { execFileSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

type CliOptions = {
  repo: string
  base: string
  target: string
  out: string
}

type BranchChangeType = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U'

type BranchCompareFileMetric = {
  path: string
  changeType: BranchChangeType
  additions: number
  deletions: number
  churn: number
  oldPath?: string
}

type GitBranchCompareReport = {
  type: 'git-branch-compare-report-v1'
  generatedAt: string
  repoRootName: string
  baseRef: string
  targetRef: string
  mergeBase: string
  summary: {
    changedFiles: number
    added: number
    modified: number
    deleted: number
    renamed: number
    totalAdditions: number
    totalDeletions: number
    totalChurn: number
  }
  files: BranchCompareFileMetric[]
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    repo: process.cwd(),
    base: 'main',
    target: 'HEAD',
    out: 'git-branch-compare-report.json',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--repo') {
      options.repo = argv[index + 1] ?? options.repo
      index += 1
      continue
    }
    if (token === '--base') {
      options.base = argv[index + 1] ?? options.base
      index += 1
      continue
    }
    if (token === '--target') {
      options.target = argv[index + 1] ?? options.target
      index += 1
      continue
    }
    if (token === '--out') {
      options.out = argv[index + 1] ?? options.out
      index += 1
      continue
    }
  }

  options.repo = resolve(options.repo)
  options.out = resolve(options.repo, options.out)
  return options
}

function normalizePath(input: string) {
  return input.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

function extractPathFromNumstat(rawPath: string) {
  const normalized = normalizePath(rawPath)
  if (!normalized.includes('=>')) {
    return normalized
  }

  if (normalized.includes('{') && normalized.includes('}')) {
    const start = normalized.indexOf('{')
    const end = normalized.indexOf('}', start + 1)
    if (start >= 0 && end > start) {
      const prefix = normalized.slice(0, start)
      const inside = normalized.slice(start + 1, end)
      const suffix = normalized.slice(end + 1)
      const right = inside.split('=>')[1]?.trim()
      if (right) {
        return normalizePath(`${prefix}${right}${suffix}`)
      }
    }
  }

  const right = normalized.split('=>')[1]?.trim()
  return right ? normalizePath(right) : normalized
}

function runGit(repo: string, args: string[]) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 20,
  }).trimEnd()
}

function normalizeChangeType(input: string): BranchChangeType {
  const raw = input.trim().charAt(0).toUpperCase()
  if (raw === 'A' || raw === 'D' || raw === 'R' || raw === 'C' || raw === 'T' || raw === 'U') {
    return raw
  }
  return 'M'
}

function buildReport(options: CliOptions): GitBranchCompareReport {
  const mergeBase = runGit(options.repo, ['merge-base', options.base, options.target]).trim()
  if (!mergeBase) {
    throw new Error(`Cannot resolve merge-base for ${options.base} and ${options.target}.`)
  }

  const statusLines = runGit(options.repo, ['diff', '--name-status', '--find-renames', mergeBase, options.target]).split(/\r?\n/)
  const statusByPath = new Map<string, { changeType: BranchChangeType; oldPath?: string }>()

  for (const line of statusLines) {
    if (!line) {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 2) {
      continue
    }
    const changeType = normalizeChangeType(parts[0] ?? 'M')
    if (changeType === 'R' || changeType === 'C') {
      const oldPath = normalizePath(parts[1] ?? '')
      const newPath = normalizePath(parts[2] ?? '')
      if (!newPath) {
        continue
      }
      statusByPath.set(newPath, { changeType, oldPath: oldPath || undefined })
      continue
    }
    const path = normalizePath(parts[1] ?? '')
    if (!path) {
      continue
    }
    statusByPath.set(path, { changeType })
  }

  const numstatLines = runGit(options.repo, ['diff', '--numstat', '--find-renames', mergeBase, options.target]).split(/\r?\n/)
  const numstatByPath = new Map<string, { additions: number; deletions: number }>()

  for (const line of numstatLines) {
    if (!line) {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const additionsRaw = parts[0] ?? '0'
    const deletionsRaw = parts[1] ?? '0'
    const path = extractPathFromNumstat(parts.slice(2).join('\t'))
    if (!path) {
      continue
    }
    const additions = additionsRaw === '-' ? 0 : Number(additionsRaw)
    const deletions = deletionsRaw === '-' ? 0 : Number(deletionsRaw)
    if (!Number.isFinite(additions) || !Number.isFinite(deletions)) {
      continue
    }
    numstatByPath.set(path, { additions, deletions })
  }

  const allPaths = new Set<string>([...statusByPath.keys(), ...numstatByPath.keys()])
  const files: BranchCompareFileMetric[] = [...allPaths]
    .map((path) => {
      const status = statusByPath.get(path)
      const metric = numstatByPath.get(path) ?? { additions: 0, deletions: 0 }
      return {
        path,
        changeType: status?.changeType ?? 'M',
        additions: metric.additions,
        deletions: metric.deletions,
        churn: metric.additions + metric.deletions,
        oldPath: status?.oldPath,
      }
    })
    .sort((left, right) => right.churn - left.churn || left.path.localeCompare(right.path))

  const summary = {
    changedFiles: files.length,
    added: files.filter((item) => item.changeType === 'A').length,
    modified: files.filter((item) => item.changeType === 'M' || item.changeType === 'T').length,
    deleted: files.filter((item) => item.changeType === 'D').length,
    renamed: files.filter((item) => item.changeType === 'R').length,
    totalAdditions: files.reduce((sum, item) => sum + item.additions, 0),
    totalDeletions: files.reduce((sum, item) => sum + item.deletions, 0),
    totalChurn: files.reduce((sum, item) => sum + item.churn, 0),
  }

  return {
    type: 'git-branch-compare-report-v1',
    generatedAt: new Date().toISOString(),
    repoRootName: basename(options.repo),
    baseRef: options.base,
    targetRef: options.target,
    mergeBase,
    summary,
    files,
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const report = buildReport(options)
  writeFileSync(options.out, JSON.stringify(report, null, 2), 'utf8')
  process.stdout.write(`Git branch compare report written: ${options.out}\n`)
  process.stdout.write(
    `Range: ${report.baseRef}...${report.targetRef} (merge-base ${report.mergeBase.slice(0, 12)})\n`,
  )
  process.stdout.write(`Changed files: ${report.summary.changedFiles}\n`)
}

main()
