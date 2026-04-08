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
      scrollToIndex: vi.fn(),
    }
  },
}))

// localStorage mock (jsdom은 opaque origin에서 localStorage를 지원하지 않으므로 stub 필요)
const localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) }),
  get length() { return Object.keys(localStorageStore).length },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
}
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
})

// window.api mock (Electron preload은 테스트 환경에서 실행되지 않으므로 stub 필요)
Object.defineProperty(window, 'api', {
  writable: true,
  value: {
    getPlatform: vi.fn().mockResolvedValue('darwin'),
    exportHtml: vi.fn().mockResolvedValue(true),
    resumeSession: vi.fn().mockResolvedValue(null),
    getProjects: vi.fn().mockResolvedValue([]),
    getSessions: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    globalSearch: vi.fn().mockResolvedValue([]),
    onSessionUpdated: vi.fn().mockReturnValue(() => {}),
  },
})
