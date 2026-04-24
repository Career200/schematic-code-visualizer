export function normalizePath(inputPath: string) {
  const isAbsolute = inputPath.startsWith('/')
  const parts = inputPath.replaceAll('\\', '/').split('/')
  const normalizedParts: string[] = []

  for (const part of parts) {
    if (!part || part === '.') {
      continue
    }
    if (part === '..') {
      if (normalizedParts.length > 0 && normalizedParts[normalizedParts.length - 1] !== '..') {
        normalizedParts.pop()
      } else if (!isAbsolute) {
        normalizedParts.push('..')
      }
      continue
    }
    normalizedParts.push(part)
  }

  const normalized = normalizedParts.join('/')
  if (isAbsolute) {
    return `/${normalized}`
  }
  return normalized
}

export function dirname(filePath: string) {
  const normalized = normalizePath(filePath)
  const cutIndex = normalized.lastIndexOf('/')
  if (cutIndex < 0) {
    return ''
  }
  return normalized.slice(0, cutIndex)
}

export function joinPath(basePath: string, extraPath: string) {
  if (!basePath) {
    return normalizePath(extraPath)
  }
  return normalizePath(`${basePath}/${extraPath}`)
}
