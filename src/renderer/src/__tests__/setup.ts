import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => {
    const items = Array.from({ length: count }, (_, i) => ({
      index: i,
      start: i * estimateSize(),
      size: estimateSize(),
      key: i,
      lane: 0,
    }))
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * estimateSize(),
      measureElement: () => undefined,
    }
  },
}))
