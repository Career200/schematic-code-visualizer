import ts from 'typescript'
import type { DependencyEdge, DependencyGraph, FileAnalysis, SourceFileRecord } from './models'
import { dirname, joinPath } from './path-utils'

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx']

function scriptKindFromPath(path: string) {
  return path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

function hasExportModifier(node: ts.Node) {
  if (!ts.canHaveModifiers(node)) {
    return false
  }
  const modifiers = ts.getModifiers(node)
  return !!modifiers?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

function addExportedBindingNames(list: string[], declarationList: ts.VariableDeclarationList) {
  for (const declaration of declarationList.declarations) {
    if (ts.isIdentifier(declaration.name)) {
      list.push(declaration.name.text)
    }
  }
}

function collectFileAnalysis(file: SourceFileRecord): { imports: string[]; exports: string[] } {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFromPath(file.path),
  )

  const imports: string[] = []
  const exports: string[] = []

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text)
    }

    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text)
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push(element.name.text)
        }
      }
    }

    if (ts.isExportAssignment(node)) {
      exports.push('default')
    }

    if (ts.isFunctionDeclaration(node) && hasExportModifier(node) && node.name) {
      exports.push(node.name.text)
    }
    if (ts.isClassDeclaration(node) && hasExportModifier(node) && node.name) {
      exports.push(node.name.text)
    }
    if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
      exports.push(node.name.text)
    }
    if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
      exports.push(node.name.text)
    }
    if (ts.isEnumDeclaration(node) && hasExportModifier(node)) {
      exports.push(node.name.text)
    }
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      addExportedBindingNames(exports, node.declarationList)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return { imports, exports }
}

function resolveImport(
  importingFilePath: string,
  specifier: string,
  projectFileSet: Set<string>,
) {
  if (!specifier.startsWith('.')) {
    return null
  }

  const base = joinPath(dirname(importingFilePath), specifier)
  const candidates = [base]

  for (const extension of SUPPORTED_EXTENSIONS) {
    candidates.push(`${base}${extension}`)
    candidates.push(`${base}/index${extension}`)
  }

  for (const candidate of candidates) {
    if (projectFileSet.has(candidate)) {
      return candidate
    }
  }

  return null
}

export function analyzeProjectDependencies(files: SourceFileRecord[]): DependencyGraph {
  const projectFileSet = new Set(files.map((file) => file.path))
  const analyses: FileAnalysis[] = []
  const edges: DependencyEdge[] = []
  let unresolvedImportCount = 0

  for (const file of files) {
    const { imports, exports } = collectFileAnalysis(file)
    const resolvedImports: string[] = []
    const unresolvedImports: string[] = []

    for (const specifier of imports) {
      const resolvedPath = resolveImport(file.path, specifier, projectFileSet)
      if (!resolvedPath) {
        unresolvedImports.push(specifier)
        continue
      }
      resolvedImports.push(resolvedPath)
      edges.push({
        fromPath: file.path,
        toPath: resolvedPath,
        specifier,
      })
    }

    unresolvedImportCount += unresolvedImports.length
    analyses.push({
      path: file.path,
      imports,
      exports,
      resolvedImports,
      unresolvedImports,
    })
  }

  return {
    files: analyses,
    edges,
    unresolvedImportCount,
  }
}
