import type { ActionItem, Category } from './actions'

export type MenuLevel =
  | { kind: 'categories'; items: Category[] }
  | { kind: 'actions'; label: string; items: ActionItem[] }

const stack: MenuLevel[] = []

export function push(level: MenuLevel): void {
  stack.push(level)
}

export function pop(): MenuLevel | undefined {
  stack.pop()
  return current()
}

export function current(): MenuLevel | undefined {
  return stack[stack.length - 1]
}

export function reset(): void {
  stack.length = 0
}

export function depth(): number {
  return stack.length
}
