import type { TreeNode } from './models'

export function buildTreeLines(node: TreeNode | null) {
  if (!node) {
    return []
  }

  const lines: string[] = []

  function walk(current: TreeNode, prefix: string) {
    const children = current.children ?? []
    children.forEach((child, index) => {
      const isLast = index === children.length - 1
      const marker = isLast ? '\\--' : '+--'
      const typeMarker = child.type === 'directory' ? '[D]' : '[F]'
      lines.push(`${prefix}${marker} ${typeMarker} ${child.name}`)
      if (child.children && child.children.length > 0) {
        walk(child, `${prefix}${isLast ? '    ' : '|   '}`)
      }
    })
  }

  lines.push(`[D] ${node.name}`)
  walk(node, '')
  return lines
}
