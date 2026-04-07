# Claude Session Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `~/.claude/projects/` 의 클로드 세션 .jsonl 파일을 탐색·검색·열람하는 Electron 데스크톱 앱을 TDD로 구현한다.

**Architecture:** Electron 메인 프로세스가 파일 읽기·감시·검색을 담당하고 IPC로 렌더러에 데이터를 전달한다. React 렌더러는 3-패널 레이아웃(프로젝트 → 세션 → 대화)을 표시하며, 전체 검색(⌘K)과 세션 내 검색(⌘F)을 제공한다. 테스트는 Vitest + RTL로 작성하며 함수명은 한글로 한다.

**Tech Stack:** Electron, React, TypeScript, electron-vite, Vitest, React Testing Library, react-markdown, highlight.js, @tanstack/react-virtual

---

## 파일 구조

```
claude-session-viewer/
├── src/
│   ├── main/
│   │   ├── index.ts          # BrowserWindow 생성, IPC 핸들러
│   │   └── watcher.ts        # fs.watch 래퍼
│   ├── preload/
│   │   └── index.ts          # contextBridge로 window.api 노출
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── types.ts       # 공유 타입 (Project, Session, Message)
│           ├── lib/
│           │   ├── parser.ts  # .jsonl 문자열 → Message[] (순수 함수)
│           │   └── search.ts  # 세션 내 검색 (순수 함수)
│           ├── components/
│           │   ├── ProjectList.tsx
│           │   ├── SessionList.tsx
│           │   ├── ConversationView.tsx
│           │   └── GlobalSearch.tsx
│           └── hooks/
│               └── useSessions.ts
├── src/renderer/src/__tests__/
│   ├── setup.ts
│   ├── lib/
│   │   ├── parser.test.ts
│   │   └── search.test.ts
│   └── components/
│       ├── ProjectList.test.tsx
│       ├── SessionList.test.tsx
│       ├── ConversationView.test.tsx
│       └── GlobalSearch.test.tsx
├── electron.vite.config.ts
├── vitest.config.ts
└── package.json
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `package.json` (electron-vite 스캐폴드 전체)
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: electron-vite react-ts 템플릿으로 프로젝트 생성**

```bash
cd /Users/donghyeon/claude-session-viewer
npm create electron-vite@latest . -- --template react-ts
```

프롬프트가 나오면 현재 디렉토리(`.`)에 덮어쓰기 허용.

- [ ] **Step 2: 추가 의존성 설치**

```bash
npm install
npm install react-markdown highlight.js @tanstack/react-virtual
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: vitest.config.ts 생성**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/__tests__/setup.ts'],
    include: ['src/renderer/src/__tests__/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: 테스트 setup 파일 생성**

```bash
mkdir -p src/renderer/src/__tests__/lib
mkdir -p src/renderer/src/__tests__/components
```

```ts
// src/renderer/src/__tests__/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: package.json에 test 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: 빌드 및 테스트 실행 확인**

```bash
npm run test:run
```

Expected: no test files found (0 tests), exit 0.

- [ ] **Step 7: 커밋**

```bash
git init
git add .
git commit -m "chore: electron-vite react-ts 초기 설정"
```

---

## Task 2: 공유 타입 정의

**Files:**
- Create: `src/renderer/src/types.ts`

- [ ] **Step 1: types.ts 생성**

```ts
// src/renderer/src/types.ts

export interface Project {
  id: string        // 디렉토리명 (예: "-Users-donghyeon-AndroidStudioProjects-foo")
  name: string      // 표시용 이름 (예: "foo")
  path: string      // 실제 경로 (예: "/Users/donghyeon/AndroidStudioProjects/foo")
  sessionCount: number
}

export interface Session {
  id: string           // UUID (파일명에서 확장자 제거)
  projectId: string
  startedAt: string    // ISO 8601 문자열 (IPC 직렬화를 위해 Date 대신 string)
  messageCount: number
  preview: string      // 첫 사용자 메시지 앞 100자
}

export interface Message {
  uuid: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string    // ISO 8601 문자열
}

export interface GlobalSearchResult {
  projectId: string
  sessionId: string
  projectName: string
  sessionStartedAt: string
  messageUuid: string
  role: 'user' | 'assistant'
  snippet: string   // 매칭 전후 30자 포함
  query: string
}

// preload에서 window.api로 노출되는 IPC API 타입
export interface ElectronAPI {
  getProjects: () => Promise<Project[]>
  getSessions: (projectId: string) => Promise<Session[]>
  getMessages: (projectId: string, sessionId: string) => Promise<Message[]>
  globalSearch: (query: string) => Promise<GlobalSearchResult[]>
  onSessionUpdated: (callback: () => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/renderer/src/types.ts
git commit -m "feat: 공유 타입 정의 (Project, Session, Message, ElectronAPI)"
```

---

## Task 3: parser.ts — 기본 파싱 TDD

**Files:**
- Create: `src/renderer/src/lib/parser.ts`
- Create: `src/renderer/src/__tests__/lib/parser.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/renderer/src/__tests__/lib/parser.test.ts
import { describe, test, expect } from 'vitest'
import { parseSession } from '../../lib/parser'

describe('parseSession', () => {
  test('유저 메시지를 추출한다', () => {
    const raw = JSON.stringify({
      type: 'user',
      uuid: 'uuid-1',
      timestamp: '2026-04-07T03:00:00.000Z',
      message: { role: 'user', content: '안녕하세요' },
    })
    const messages = parseSession(raw)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('안녕하세요')
    expect(messages[0].uuid).toBe('uuid-1')
    expect(messages[0].timestamp).toBe('2026-04-07T03:00:00.000Z')
  })

  test('어시스턴트 메시지를 추출한다', () => {
    const raw = JSON.stringify({
      type: 'assistant',
      uuid: 'uuid-2',
      timestamp: '2026-04-07T03:01:00.000Z',
      message: { role: 'assistant', content: '안녕하세요!' },
    })
    const messages = parseSession(raw)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
  })

  test('메타 레코드(file-history-snapshot)는 제외된다', () => {
    const lines = [
      JSON.stringify({ type: 'file-history-snapshot', messageId: 'x', snapshot: {} }),
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-04-07T03:00:00.000Z', message: { content: '질문' } }),
    ].join('\n')
    const messages = parseSession(lines)
    expect(messages).toHaveLength(1)
  })

  test('손상된 JSON 줄은 건너뛴다', () => {
    const lines = [
      'NOT_JSON{{{',
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-04-07T03:00:00.000Z', message: { content: '정상' } }),
    ].join('\n')
    const messages = parseSession(lines)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('정상')
  })

  test('빈 문자열은 빈 배열을 반환한다', () => {
    expect(parseSession('')).toEqual([])
  })

  test('content가 배열인 경우 text 블록만 이어붙인다', () => {
    const raw = JSON.stringify({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-04-07T03:00:00.000Z',
      message: {
        content: [
          { type: 'text', text: '첫번째 ' },
          { type: 'tool_use', id: 'x' },
          { type: 'text', text: '두번째' },
        ],
      },
    })
    const messages = parseSession(raw)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('첫번째 두번째')
  })

  test('content가 없는 레코드는 제외된다', () => {
    const raw = JSON.stringify({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-04-07T03:00:00.000Z',
      message: { content: '' },
    })
    expect(parseSession(raw)).toHaveLength(0)
  })

  test('여러 줄을 순서대로 반환한다', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-04-07T03:00:00.000Z', message: { content: '첫번째' } }),
      JSON.stringify({ type: 'assistant', uuid: 'u2', timestamp: '2026-04-07T03:01:00.000Z', message: { content: '두번째' } }),
      JSON.stringify({ type: 'user', uuid: 'u3', timestamp: '2026-04-07T03:02:00.000Z', message: { content: '세번째' } }),
    ].join('\n')
    const messages = parseSession(lines)
    expect(messages).toHaveLength(3)
    expect(messages.map(m => m.content)).toEqual(['첫번째', '두번째', '세번째'])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm run test:run
```

Expected: FAIL — `Cannot find module '../../lib/parser'`

- [ ] **Step 3: parser.ts 구현**

```ts
// src/renderer/src/lib/parser.ts
import type { Message } from '../types'

interface ContentBlock {
  type: string
  text?: string
}

function extractText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('')
}

export function parseSession(raw: string): Message[] {
  const messages: Message[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line)
      if (record.type !== 'user' && record.type !== 'assistant') continue
      const content = extractText(record.message?.content ?? '')
      if (!content.trim()) continue
      messages.push({
        uuid: record.uuid ?? crypto.randomUUID(),
        role: record.type as 'user' | 'assistant',
        content,
        timestamp: record.timestamp ?? new Date().toISOString(),
      })
    } catch {
      // 손상된 줄 건너뜀
    }
  }
  return messages
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS — 7 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/lib/parser.ts src/renderer/src/__tests__/lib/parser.test.ts
git commit -m "feat: parser.ts — .jsonl 파싱 (TDD)"
```

---

## Task 4: search.ts — 세션 내 검색 TDD

**Files:**
- Create: `src/renderer/src/lib/search.ts`
- Create: `src/renderer/src/__tests__/lib/search.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/renderer/src/__tests__/lib/search.test.ts
import { describe, test, expect } from 'vitest'
import { searchInSession } from '../../lib/search'
import type { Message } from '../../types'

const 메시지들: Message[] = [
  { uuid: 'u1', role: 'user', content: 'Kotlin 리팩토링 해줘', timestamp: '2026-04-07T01:00:00.000Z' },
  { uuid: 'u2', role: 'assistant', content: '네, kotlin 파일을 읽어볼게요', timestamp: '2026-04-07T01:01:00.000Z' },
  { uuid: 'u3', role: 'user', content: '다른 질문입니다', timestamp: '2026-04-07T01:02:00.000Z' },
]

describe('searchInSession', () => {
  test('매칭되는 메시지의 인덱스를 반환한다', () => {
    const result = searchInSession(메시지들, 'kotlin')
    expect(result).toEqual([0, 1])
  })

  test('대소문자를 무시하고 검색한다', () => {
    const result = searchInSession(메시지들, 'KOTLIN')
    expect(result).toEqual([0, 1])
  })

  test('빈 쿼리는 빈 배열을 반환한다', () => {
    expect(searchInSession(메시지들, '')).toEqual([])
    expect(searchInSession(메시지들, '   ')).toEqual([])
  })

  test('매칭 없으면 빈 배열을 반환한다', () => {
    expect(searchInSession(메시지들, '존재하지않는키워드xyz')).toEqual([])
  })

  test('메시지 목록이 비어있으면 빈 배열을 반환한다', () => {
    expect(searchInSession([], 'kotlin')).toEqual([])
  })

  test('매칭된 인덱스는 원본 배열 순서를 유지한다', () => {
    const result = searchInSession(메시지들, '질문')
    expect(result).toEqual([2])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm run test:run
```

Expected: FAIL — `Cannot find module '../../lib/search'`

- [ ] **Step 3: search.ts 구현**

```ts
// src/renderer/src/lib/search.ts
import type { Message } from '../types'

/**
 * 세션 내 키워드 검색.
 * @returns 매칭된 메시지의 인덱스 배열 (원본 순서 유지)
 */
export function searchInSession(messages: Message[], query: string): number[] {
  if (!query.trim()) return []
  const lower = query.toLowerCase()
  return messages.reduce<number[]>((acc, msg, i) => {
    if (msg.content.toLowerCase().includes(lower)) acc.push(i)
    return acc
  }, [])
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS — 13 tests passed (parser 7 + search 6).

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/lib/search.ts src/renderer/src/__tests__/lib/search.test.ts
git commit -m "feat: search.ts — 세션 내 키워드 검색 (TDD)"
```

---

## Task 5: Electron 메인 프로세스

**Files:**
- Modify: `src/main/index.ts`
- Create: `src/main/watcher.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: watcher.ts 구현**

```ts
// src/main/watcher.ts
import { watch, FSWatcher } from 'fs'
import { BrowserWindow } from 'electron'

let watcher: FSWatcher | null = null

export function startWatcher(projectsDir: string, win: BrowserWindow): void {
  stopWatcher()
  try {
    watcher = watch(projectsDir, { recursive: true }, (_event, _filename) => {
      if (!win.isDestroyed()) {
        win.webContents.send('session:updated')
      }
    })
  } catch {
    // 디렉토리가 없으면 감시 건너뜀
  }
}

export function stopWatcher(): void {
  watcher?.close()
  watcher = null
}
```

- [ ] **Step 2: main/index.ts 구현**

`src/main/index.ts`의 내용을 아래로 교체:

```ts
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { readdir, readFile, stat } from 'fs/promises'
import { startWatcher } from './watcher'
import type { Project, Session, Message, GlobalSearchResult } from '../renderer/src/types'

// NOTE: parser는 renderer/src/lib/parser.ts 와 동일 로직을 메인에서 직접 실행
// electron-vite는 main/renderer가 별도 번들이므로 공유 함수를 인라인 구현
interface ContentBlock { type: string; text?: string }
function extractText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content.filter(b => b.type === 'text' && b.text).map(b => b.text!).join('')
}
function parseJsonl(raw: string): Message[] {
  const messages: Message[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      if (r.type !== 'user' && r.type !== 'assistant') continue
      const content = extractText(r.message?.content ?? '')
      if (!content.trim()) continue
      messages.push({ uuid: r.uuid ?? crypto.randomUUID(), role: r.type, content, timestamp: r.timestamp ?? new Date().toISOString() })
    } catch { /* 건너뜀 */ }
  }
  return messages
}

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  startWatcher(PROJECTS_DIR, mainWindow)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// IPC: 프로젝트 목록
ipcMain.handle('session:getProjects', async (): Promise<Project[]> => {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true })
    const projects: Project[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dirName = entry.name
      // 디렉토리명은 "/" → "-" 인코딩. 앞에 "-" 제거 후 마지막 세그먼트를 이름으로 사용
      const decoded = dirName.replace(/^-/, '/').replace(/-/g, '/')
      const name = decoded.split('/').filter(Boolean).pop() ?? dirName
      const sessionFiles = (await readdir(join(PROJECTS_DIR, dirName))).filter(f => f.endsWith('.jsonl'))
      projects.push({ id: dirName, name, path: decoded, sessionCount: sessionFiles.length })
    }
    return projects.filter(p => p.sessionCount > 0).sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
})

// IPC: 세션 목록
ipcMain.handle('session:getSessions', async (_e, projectId: string): Promise<Session[]> => {
  const dir = join(PROJECTS_DIR, projectId)
  try {
    const files = (await readdir(dir)).filter(f => f.endsWith('.jsonl'))
    const sessions: Session[] = []
    for (const file of files) {
      try {
        const raw = await readFile(join(dir, file), 'utf-8')
        const messages = parseJsonl(raw)
        if (messages.length === 0) continue
        const firstUser = messages.find(m => m.role === 'user')
        sessions.push({
          id: file.replace('.jsonl', ''),
          projectId,
          startedAt: messages[0].timestamp,
          messageCount: messages.length,
          preview: firstUser ? firstUser.content.slice(0, 100) : '',
        })
      } catch { /* 손상된 파일 건너뜀 */ }
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  } catch { return [] }
})

// IPC: 메시지 목록
ipcMain.handle('session:getMessages', async (_e, projectId: string, sessionId: string): Promise<Message[]> => {
  try {
    const raw = await readFile(join(PROJECTS_DIR, projectId, `${sessionId}.jsonl`), 'utf-8')
    return parseJsonl(raw)
  } catch { return [] }
})

// IPC: 전체 검색
ipcMain.handle('session:globalSearch', async (_e, query: string): Promise<GlobalSearchResult[]> => {
  if (!query.trim()) return []
  const lower = query.toLowerCase()
  const results: GlobalSearchResult[] = []
  try {
    const projectDirs = (await readdir(PROJECTS_DIR, { withFileTypes: true }))
      .filter(e => e.isDirectory())
    for (const pd of projectDirs) {
      const dir = join(PROJECTS_DIR, pd.name)
      const files = (await readdir(dir)).filter(f => f.endsWith('.jsonl'))
      const name = pd.name.replace(/^-/, '/').replace(/-/g, '/').split('/').filter(Boolean).pop() ?? pd.name
      for (const file of files) {
        try {
          const raw = await readFile(join(dir, file), 'utf-8')
          const messages = parseJsonl(raw)
          const sessionId = file.replace('.jsonl', '')
          const startedAt = messages[0]?.timestamp ?? ''
          for (const m of messages) {
            if (!m.content.toLowerCase().includes(lower)) continue
            const idx = m.content.toLowerCase().indexOf(lower)
            const start = Math.max(0, idx - 30)
            const end = Math.min(m.content.length, idx + query.length + 30)
            results.push({
              projectId: pd.name,
              sessionId,
              projectName: name,
              sessionStartedAt: startedAt,
              messageUuid: m.uuid,
              role: m.role,
              snippet: m.content.slice(start, end),
              query,
            })
          }
        } catch { /* 건너뜀 */ }
      }
    }
  } catch { /* 건너뜀 */ }
  return results.slice(0, 200)  // 최대 200개 반환
})
```

- [ ] **Step 3: preload/index.ts 구현**

`src/preload/index.ts` 전체를 아래로 교체:

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../renderer/src/types'

const api: ElectronAPI = {
  getProjects: () => ipcRenderer.invoke('session:getProjects'),
  getSessions: (projectId) => ipcRenderer.invoke('session:getSessions', projectId),
  getMessages: (projectId, sessionId) => ipcRenderer.invoke('session:getMessages', projectId, sessionId),
  globalSearch: (query) => ipcRenderer.invoke('session:globalSearch', query),
  onSessionUpdated: (callback) => {
    ipcRenderer.on('session:updated', callback)
    return () => ipcRenderer.removeListener('session:updated', callback)
  },
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 4: 앱 실행 확인**

```bash
npm run dev
```

Expected: 1400×900 Electron 창이 열리고 콘솔 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/main/index.ts src/main/watcher.ts src/preload/index.ts
git commit -m "feat: Electron 메인 프로세스 — IPC 핸들러, 파일 감시, preload"
```

---

## Task 6: useSessions 훅

**Files:**
- Create: `src/renderer/src/hooks/useSessions.ts`

- [ ] **Step 1: useSessions.ts 구현**

```ts
// src/renderer/src/hooks/useSessions.ts
import { useState, useEffect, useCallback } from 'react'
import type { Project, Session, Message } from '../types'

export interface SessionsState {
  projects: Project[]
  selectedProjectId: string | null
  sessions: Session[]
  selectedSessionId: string | null
  messages: Message[]
  watcherActive: boolean
  totalSessions: number
}

export function useSessions() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [watcherActive, setWatcherActive] = useState(true)

  const loadProjects = useCallback(async () => {
    try {
      const data = await window.api.getProjects()
      setProjects(data)
    } catch {
      setWatcherActive(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
    const unsubscribe = window.api.onSessionUpdated(() => {
      loadProjects()
      if (selectedProjectId) {
        window.api.getSessions(selectedProjectId).then(setSessions).catch(() => {})
      }
    })
    return unsubscribe
  }, [loadProjects, selectedProjectId])

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedSessionId(null)
    setMessages([])
    const data = await window.api.getSessions(projectId)
    setSessions(data)
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    if (!selectedProjectId) return
    setSelectedSessionId(sessionId)
    const data = await window.api.getMessages(selectedProjectId, sessionId)
    setMessages(data)
  }, [selectedProjectId])

  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0)

  return {
    projects,
    selectedProjectId,
    sessions,
    selectedSessionId,
    messages,
    watcherActive,
    totalSessions,
    selectProject,
    selectSession,
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/renderer/src/hooks/useSessions.ts
git commit -m "feat: useSessions 훅 — IPC 기반 상태 관리"
```

---

## Task 7: ProjectList 컴포넌트 TDD

**Files:**
- Create: `src/renderer/src/components/ProjectList.tsx`
- Create: `src/renderer/src/__tests__/components/ProjectList.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/renderer/src/__tests__/components/ProjectList.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectList } from '../../components/ProjectList'
import type { Project } from '../../types'

const 프로젝트들: Project[] = [
  { id: 'proj-a', name: 'album-id-changer', path: '/Users/foo/album-id-changer', sessionCount: 5 },
  { id: 'proj-b', name: 'amp-core', path: '/Users/foo/amp-core', sessionCount: 3 },
]

describe('ProjectList', () => {
  test('프로젝트 목록을 렌더링한다', () => {
    render(<ProjectList projects={프로젝트들} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('album-id-changer')).toBeInTheDocument()
    expect(screen.getByText('amp-core')).toBeInTheDocument()
  })

  test('선택된 프로젝트에 선택 스타일이 적용된다', () => {
    render(<ProjectList projects={프로젝트들} selectedId="proj-a" onSelect={() => {}} />)
    const item = screen.getByText('album-id-changer').closest('[data-selected]')
    expect(item).toHaveAttribute('data-selected', 'true')
  })

  test('프로젝트 클릭 시 onSelect가 해당 id로 호출된다', () => {
    const onSelect = vi.fn()
    render(<ProjectList projects={프로젝트들} selectedId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('amp-core'))
    expect(onSelect).toHaveBeenCalledWith('proj-b')
  })

  test('세션 수를 표시한다', () => {
    render(<ProjectList projects={프로젝트들} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('프로젝트가 없으면 빈 목록을 렌더링한다', () => {
    const { container } = render(<ProjectList projects={[]} selectedId={null} onSelect={() => {}} />)
    expect(container.querySelectorAll('[data-testid="project-item"]')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm run test:run
```

Expected: FAIL — `Cannot find module '../../components/ProjectList'`

- [ ] **Step 3: ProjectList.tsx 구현**

```tsx
// src/renderer/src/components/ProjectList.tsx
import type { Project } from '../types'

interface Props {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ProjectList({ projects, selectedId, onSelect }: Props) {
  return (
    <div className="panel project-list">
      <div className="panel-header">PROJECTS</div>
      {projects.map((p) => (
        <div
          key={p.id}
          data-testid="project-item"
          data-selected={p.id === selectedId}
          className={`project-item ${p.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          <span className="project-name">{p.name}</span>
          <span className="session-count">{p.sessionCount}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS — all ProjectList tests pass.

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/components/ProjectList.tsx src/renderer/src/__tests__/components/ProjectList.test.tsx
git commit -m "feat: ProjectList 컴포넌트 (TDD)"
```

---

## Task 8: SessionList 컴포넌트 TDD

**Files:**
- Create: `src/renderer/src/components/SessionList.tsx`
- Create: `src/renderer/src/__tests__/components/SessionList.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/renderer/src/__tests__/components/SessionList.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionList } from '../../components/SessionList'
import type { Session } from '../../types'

const 세션들: Session[] = [
  { id: 'sess-1', projectId: 'proj-a', startedAt: '2026-04-07T06:04:00.000Z', messageCount: 378, preview: '리팩토링 해줘' },
  { id: 'sess-2', projectId: 'proj-a', startedAt: '2026-04-06T02:22:00.000Z', messageCount: 124, preview: '새 기능 추가' },
]

describe('SessionList', () => {
  test('세션 목록을 렌더링한다', () => {
    render(<SessionList sessions={세션들} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('리팩토링 해줘')).toBeInTheDocument()
    expect(screen.getByText('새 기능 추가')).toBeInTheDocument()
  })

  test('메시지 수를 표시한다', () => {
    render(<SessionList sessions={세션들} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('378')).toBeInTheDocument()
    expect(screen.getByText('124')).toBeInTheDocument()
  })

  test('날짜를 로컬 형식으로 표시한다', () => {
    render(<SessionList sessions={세션들} selectedId={null} onSelect={() => {}} />)
    // 날짜 텍스트가 렌더링되는지 확인 (정확한 포맷은 locale에 따라 다름)
    expect(screen.getAllByTestId('session-date').length).toBe(2)
  })

  test('세션 클릭 시 onSelect가 해당 id로 호출된다', () => {
    const onSelect = vi.fn()
    render(<SessionList sessions={세션들} selectedId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('새 기능 추가'))
    expect(onSelect).toHaveBeenCalledWith('sess-2')
  })

  test('선택된 세션에 selected 클래스가 적용된다', () => {
    render(<SessionList sessions={세션들} selectedId="sess-1" onSelect={() => {}} />)
    const item = screen.getByText('리팩토링 해줘').closest('.session-item')
    expect(item).toHaveClass('selected')
  })

  test('세션이 없으면 빈 상태 메시지를 표시한다', () => {
    render(<SessionList sessions={[]} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('세션이 없습니다')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm run test:run
```

Expected: FAIL

- [ ] **Step 3: SessionList.tsx 구현**

```tsx
// src/renderer/src/components/SessionList.tsx
import type { Session } from '../types'

interface Props {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: false,
  })
}

export function SessionList({ sessions, selectedId, onSelect }: Props) {
  return (
    <div className="panel session-list">
      <div className="panel-header">SESSIONS · {sessions.length}</div>
      {sessions.length === 0 && (
        <div className="empty-state">세션이 없습니다</div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          className={`session-item ${s.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(s.id)}
        >
          <div className="session-date" data-testid="session-date">{formatDate(s.startedAt)}</div>
          <div className="session-preview">{s.preview}</div>
          <div className="session-count">{s.messageCount}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/components/SessionList.tsx src/renderer/src/__tests__/components/SessionList.test.tsx
git commit -m "feat: SessionList 컴포넌트 (TDD)"
```

---

## Task 9: ConversationView 컴포넌트 TDD

**Files:**
- Create: `src/renderer/src/components/ConversationView.tsx`
- Create: `src/renderer/src/__tests__/components/ConversationView.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/renderer/src/__tests__/components/ConversationView.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationView } from '../../components/ConversationView'
import type { Message } from '../../types'

const 메시지들: Message[] = [
  { uuid: 'u1', role: 'user', content: 'Kotlin 리팩토링 해줘', timestamp: '2026-04-07T06:00:00.000Z' },
  { uuid: 'u2', role: 'assistant', content: '네, kotlin 파일을 읽어볼게요', timestamp: '2026-04-07T06:01:00.000Z' },
  { uuid: 'u3', role: 'user', content: '다른 질문입니다', timestamp: '2026-04-07T06:02:00.000Z' },
]

describe('ConversationView', () => {
  test('메시지 목록을 렌더링한다', () => {
    render(<ConversationView messages={메시지들} />)
    expect(screen.getByText('Kotlin 리팩토링 해줘')).toBeInTheDocument()
    expect(screen.getByText('네, kotlin 파일을 읽어볼게요')).toBeInTheDocument()
  })

  test('유저 메시지와 어시스턴트 메시지에 다른 클래스가 적용된다', () => {
    render(<ConversationView messages={메시지들} />)
    const userMsgs = document.querySelectorAll('.message-user')
    const assistMsgs = document.querySelectorAll('.message-assistant')
    expect(userMsgs.length).toBe(2)
    expect(assistMsgs.length).toBe(1)
  })

  test('세션 내 검색에서 매칭 텍스트가 하이라이트된다', async () => {
    render(<ConversationView messages={메시지들} />)
    const searchInput = screen.getByPlaceholderText('이 대화에서 검색... (⌘F)')
    await userEvent.type(searchInput, 'kotlin')
    // 두 메시지에서 매칭 — highlight span이 렌더링됨
    const highlights = document.querySelectorAll('.search-highlight')
    expect(highlights.length).toBeGreaterThanOrEqual(2)
  })

  test('검색 결과 수를 표시한다', async () => {
    render(<ConversationView messages={메시지들} />)
    const searchInput = screen.getByPlaceholderText('이 대화에서 검색... (⌘F)')
    await userEvent.type(searchInput, 'kotlin')
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument()
  })

  test('다음 결과 버튼 클릭 시 포커스가 이동한다', async () => {
    render(<ConversationView messages={메시지들} />)
    const searchInput = screen.getByPlaceholderText('이 대화에서 검색... (⌘F)')
    await userEvent.type(searchInput, 'kotlin')
    fireEvent.click(screen.getByText('↓'))
    expect(screen.getByText(/2\s*\/\s*2/)).toBeInTheDocument()
  })

  test('빈 검색어를 지우면 하이라이트가 사라진다', async () => {
    render(<ConversationView messages={메시지들} />)
    const searchInput = screen.getByPlaceholderText('이 대화에서 검색... (⌘F)')
    await userEvent.type(searchInput, 'kotlin')
    await userEvent.clear(searchInput)
    expect(document.querySelectorAll('.search-highlight')).toHaveLength(0)
  })

  test('메시지가 없으면 빈 상태를 표시한다', () => {
    render(<ConversationView messages={[]} />)
    expect(screen.getByText('세션을 선택하세요')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm run test:run
```

Expected: FAIL

- [ ] **Step 3: ConversationView.tsx 구현**

```tsx
// src/renderer/src/components/ConversationView.tsx
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Message } from '../types'
import { searchInSession } from '../lib/search'

interface Props {
  messages: Message[]
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const lower = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lower.indexOf(lowerQuery)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {highlightText(text.slice(idx + query.length), query)}
    </>
  )
}

export function ConversationView({ messages }: Props) {
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const matchedIndices = searchInSession(messages, query)
  const totalMatches = matchedIndices.length
  const currentMatch = totalMatches > 0 ? matchIndex + 1 : 0

  // 검색어 변경 시 첫 결과로 리셋
  useEffect(() => { setMatchIndex(0) }, [query])

  // ⌘F 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const goNext = () => setMatchIndex((i) => (i + 1) % totalMatches)
  const goPrev = () => setMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)

  if (messages.length === 0) {
    return <div className="panel conversation-view empty"><span>세션을 선택하세요</span></div>
  }

  return (
    <div className="panel conversation-view">
      {/* 세션 내 검색 바 */}
      <div className="in-session-search">
        <span className="search-icon">🔎</span>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="이 대화에서 검색... (⌘F)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
            if (e.key === 'Escape') setQuery('')
          }}
        />
        {totalMatches > 0 && (
          <span className="match-count">{currentMatch} / {totalMatches}</span>
        )}
        <button onClick={goPrev} disabled={totalMatches === 0}>↑</button>
        <button onClick={goNext} disabled={totalMatches === 0}>↓</button>
        {query && <button onClick={() => setQuery('')}>✕</button>}
      </div>

      {/* 메시지 목록 */}
      <div className="messages">
        {messages.map((msg, idx) => {
          const isFocused = matchedIndices[matchIndex] === idx
          return (
            <div
              key={msg.uuid}
              id={`msg-${msg.uuid}`}
              className={`message message-${msg.role} ${isFocused ? 'search-focused' : ''}`}
            >
              <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="message-content">
                <ReactMarkdown>{query ? msg.content : msg.content}</ReactMarkdown>
                {query && msg.content.toLowerCase().includes(query.toLowerCase()) && (
                  <div className="message-highlighted">
                    {highlightText(msg.content, query)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/components/ConversationView.tsx src/renderer/src/__tests__/components/ConversationView.test.tsx
git commit -m "feat: ConversationView 컴포넌트 — 메시지 렌더링 + 세션 내 검색 (TDD)"
```

---

## Task 10: GlobalSearch 모달 TDD

**Files:**
- Create: `src/renderer/src/components/GlobalSearch.tsx`
- Create: `src/renderer/src/__tests__/components/GlobalSearch.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/renderer/src/__tests__/components/GlobalSearch.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalSearch } from '../../components/GlobalSearch'
import type { GlobalSearchResult } from '../../types'

const 검색결과: GlobalSearchResult[] = [
  {
    projectId: 'proj-a', sessionId: 'sess-1',
    projectName: 'album-id-changer', sessionStartedAt: '2026-04-07T06:00:00.000Z',
    messageUuid: 'u1', role: 'user',
    snippet: '...kotlin 리팩토링 해줘...', query: 'kotlin',
  },
]

beforeEach(() => {
  window.api = {
    getProjects: vi.fn(),
    getSessions: vi.fn(),
    getMessages: vi.fn(),
    globalSearch: vi.fn().mockResolvedValue(검색결과),
    onSessionUpdated: vi.fn().mockReturnValue(() => {}),
  }
})

describe('GlobalSearch', () => {
  test('열려 있을 때 검색 입력창을 렌더링한다', () => {
    render(<GlobalSearch isOpen={true} onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.getByPlaceholderText('전체 세션 검색...')).toBeInTheDocument()
  })

  test('닫혀 있을 때 렌더링하지 않는다', () => {
    render(<GlobalSearch isOpen={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.queryByPlaceholderText('전체 세션 검색...')).not.toBeInTheDocument()
  })

  test('검색어 입력 시 window.api.globalSearch가 호출된다', async () => {
    render(<GlobalSearch isOpen={true} onClose={() => {}} onNavigate={() => {}} />)
    const input = screen.getByPlaceholderText('전체 세션 검색...')
    await userEvent.type(input, 'kotlin')
    await waitFor(() => expect(window.api.globalSearch).toHaveBeenCalledWith('kotlin'))
  })

  test('검색 결과를 렌더링한다', async () => {
    render(<GlobalSearch isOpen={true} onClose={() => {}} onNavigate={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText('전체 세션 검색...'), 'kotlin')
    await waitFor(() => expect(screen.getByText('album-id-changer')).toBeInTheDocument())
    expect(screen.getByText(/kotlin 리팩토링 해줘/)).toBeInTheDocument()
  })

  test('결과 클릭 시 onNavigate가 올바른 인자로 호출된다', async () => {
    const onNavigate = vi.fn()
    render(<GlobalSearch isOpen={true} onClose={() => {}} onNavigate={onNavigate} />)
    await userEvent.type(screen.getByPlaceholderText('전체 세션 검색...'), 'kotlin')
    await waitFor(() => screen.getByText('album-id-changer'))
    fireEvent.click(screen.getByText(/kotlin 리팩토링 해줘/))
    expect(onNavigate).toHaveBeenCalledWith('proj-a', 'sess-1', 'u1')
  })

  test('Escape 키로 모달을 닫는다', async () => {
    const onClose = vi.fn()
    render(<GlobalSearch isOpen={true} onClose={onClose} onNavigate={() => {}} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm run test:run
```

Expected: FAIL

- [ ] **Step 3: GlobalSearch.tsx 구현**

```tsx
// src/renderer/src/components/GlobalSearch.tsx
import { useState, useEffect, useRef } from 'react'
import type { GlobalSearchResult } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onNavigate: (projectId: string, sessionId: string, messageUuid: string) => void
}

export function GlobalSearch({ isOpen, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const data = await window.api.globalSearch(query)
      setResults(data)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  return (
    <div className="global-search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="global-search-modal">
        <input
          ref={inputRef}
          type="text"
          placeholder="전체 세션 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="search-results">
          {results.map((r) => (
            <div
              key={`${r.sessionId}-${r.messageUuid}`}
              className="search-result-item"
              onClick={() => { onNavigate(r.projectId, r.sessionId, r.messageUuid); onClose() }}
            >
              <div className="result-meta">
                <span className="result-project">{r.projectName}</span>
                <span className="result-date">{new Date(r.sessionStartedAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="result-snippet">{r.snippet}</div>
            </div>
          ))}
          {query && results.length === 0 && (
            <div className="no-results">결과 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/components/GlobalSearch.tsx src/renderer/src/__tests__/components/GlobalSearch.test.tsx
git commit -m "feat: GlobalSearch 모달 — 전체 세션 검색 (TDD)"
```

---

## Task 11: App 레이아웃 조립

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/App.css`

- [ ] **Step 1: App.tsx 구현**

`src/renderer/src/App.tsx` 전체를 아래로 교체:

```tsx
import { useState, useEffect } from 'react'
import { ProjectList } from './components/ProjectList'
import { SessionList } from './components/SessionList'
import { ConversationView } from './components/ConversationView'
import { GlobalSearch } from './components/GlobalSearch'
import { useSessions } from './hooks/useSessions'
import './App.css'

export function App() {
  const {
    projects, selectedProjectId, sessions, selectedSessionId,
    messages, watcherActive, totalSessions,
    selectProject, selectSession,
  } = useSessions()

  const [searchOpen, setSearchOpen] = useState(false)

  // ⌘K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleNavigate = (projectId: string, sessionId: string) => {
    selectProject(projectId).then(() => selectSession(sessionId))
  }

  return (
    <div className="app">
      {/* 상단 전체 검색 바 */}
      <div className="top-bar" onClick={() => setSearchOpen(true)}>
        <span className="search-icon">🔍</span>
        <span className="search-placeholder">전체 세션 검색... (⌘K)</span>
        <span className="stats">{projects.length} projects · {totalSessions} sessions</span>
      </div>

      {/* 3-패널 */}
      <div className="panels">
        <ProjectList
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={selectProject}
        />
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={selectSession}
        />
        <ConversationView messages={messages} />
      </div>

      {/* 하단 상태바 */}
      <div className="status-bar">
        <span className={`watcher-status ${watcherActive ? 'active' : 'inactive'}`}>
          ● {watcherActive ? '파일 감시 중' : '감시 중단됨'}
        </span>
        <span>{projects.length}개 프로젝트 · {totalSessions}개 세션</span>
        <span className="projects-dir">~/.claude/projects/</span>
      </div>

      {/* 전체 검색 모달 */}
      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(projectId, sessionId, _messageUuid) => handleNavigate(projectId, sessionId)}
      />
    </div>
  )
}

export default App
```

- [ ] **Step 2: App.css 구현**

```css
/* src/renderer/src/App.css */
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border: #30363d;
  --text-primary: #f0f6fc;
  --text-secondary: #c9d1d9;
  --text-muted: #8b949e;
  --accent: #58a6ff;
  --success: #3fb950;
  --user-bg: #21262d;
  --assistant-bg: #1a2e1a;
}

body { background: var(--bg-primary); color: var(--text-primary); font-family: -apple-system, sans-serif; }

.app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* 상단 검색 바 */
.top-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px; background: var(--bg-secondary);
  border-bottom: 1px solid var(--border); cursor: pointer; flex-shrink: 0;
}
.top-bar:hover { background: var(--bg-tertiary); }
.search-placeholder { flex: 1; font-size: 13px; color: var(--text-muted); }
.stats { font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px; }

/* 3-패널 */
.panels { display: flex; flex: 1; overflow: hidden; }

.panel { display: flex; flex-direction: column; overflow: hidden; }
.panel-header { padding: 8px 14px; font-size: 10px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0; }

/* ProjectList */
.project-list { width: 220px; border-right: 1px solid var(--border); background: var(--bg-primary); overflow-y: auto; flex-shrink: 0; }
.project-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 13px; color: var(--text-muted); cursor: pointer; border-left: 3px solid transparent; }
.project-item:hover { background: var(--bg-secondary); }
.project-item.selected { background: var(--bg-tertiary); color: var(--text-primary); border-left-color: var(--accent); }
.session-count { font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 10px; }

/* SessionList */
.session-list { width: 280px; border-right: 1px solid var(--border); background: var(--bg-primary); overflow-y: auto; flex-shrink: 0; }
.session-item { padding: 12px 14px; cursor: pointer; border-bottom: 1px solid var(--bg-secondary); border-left: 3px solid transparent; }
.session-item:hover { background: var(--bg-secondary); }
.session-item.selected { background: var(--bg-tertiary); border-left-color: var(--accent); }
.session-date { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
.session-preview { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.session-count { font-size: 10px; color: var(--success); }
.empty-state { padding: 20px; font-size: 12px; color: var(--text-muted); text-align: center; }

/* ConversationView */
.conversation-view { flex: 1; min-width: 0; }
.conversation-view.empty { align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; }

/* 세션 내 검색 */
.in-session-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--bg-secondary);
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.in-session-search input { flex: 1; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; color: var(--text-primary); font-size: 12px; outline: none; }
.in-session-search input:focus { border-color: var(--accent); }
.match-count { font-size: 11px; color: var(--accent); white-space: nowrap; }
.in-session-search button { background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); cursor: pointer; padding: 2px 6px; font-size: 12px; }
.in-session-search button:disabled { opacity: 0.3; cursor: default; }

/* 메시지 */
.messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.message { display: flex; gap: 10px; align-items: flex-start; }
.message-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.message-user .message-avatar { background: var(--user-bg); }
.message-assistant .message-avatar { background: var(--assistant-bg); }
.message-content { background: var(--user-bg); border-radius: 8px; padding: 10px 14px; font-size: 13px; line-height: 1.6; max-width: 85%; }
.message-assistant .message-content { background: var(--assistant-bg); }
.message-content pre { background: var(--bg-primary); border-radius: 6px; padding: 10px; overflow-x: auto; margin-top: 8px; }
.message-content code { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.search-highlight { background: #f0e68c; color: #000; border-radius: 2px; padding: 0 1px; }
.search-focused .message-content { outline: 2px solid var(--accent); }
.message-highlighted { margin-top: 4px; font-size: 12px; }

/* GlobalSearch */
.global-search-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-start; justify-content: center; padding-top: 10vh; z-index: 1000; }
.global-search-modal { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; width: 600px; max-height: 70vh; overflow: hidden; display: flex; flex-direction: column; }
.global-search-modal input { padding: 14px 16px; font-size: 15px; background: none; border: none; border-bottom: 1px solid var(--border); color: var(--text-primary); outline: none; }
.search-results { overflow-y: auto; }
.search-result-item { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--bg-tertiary); }
.search-result-item:hover { background: var(--bg-tertiary); }
.result-meta { display: flex; gap: 10px; margin-bottom: 4px; }
.result-project { font-size: 11px; font-weight: bold; color: var(--accent); }
.result-date { font-size: 11px; color: var(--text-muted); }
.result-snippet { font-size: 12px; color: var(--text-secondary); }
.no-results { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }

/* 하단 상태바 */
.status-bar { display: flex; gap: 20px; align-items: center; padding: 4px 16px; background: var(--bg-secondary); border-top: 1px solid var(--border); font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.watcher-status.active { color: var(--success); }
.watcher-status.inactive { color: #f85149; }
.projects-dir { margin-left: auto; }
```

- [ ] **Step 3: src/renderer/src/main.tsx 확인 및 수정**

`src/renderer/src/main.tsx` 가 `App`을 올바르게 import하는지 확인:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: 앱 실행 및 통합 확인**

```bash
npm run dev
```

확인 사항:
1. `~/.claude/projects/` 의 프로젝트가 왼쪽 패널에 표시됨
2. 프로젝트 클릭 시 세션 목록이 가운데 패널에 표시됨
3. 세션 클릭 시 대화 내용이 오른쪽 패널에 표시됨
4. `⌘K` → 검색 모달 열림
5. `⌘F` → 세션 내 검색 포커스
6. 하단 상태바에 파일 감시 상태 표시

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
npm run test:run
```

Expected: PASS — 모든 테스트 통과.

- [ ] **Step 6: 최종 커밋**

```bash
git add src/renderer/src/App.tsx src/renderer/src/App.css src/renderer/src/main.tsx
git commit -m "feat: App 레이아웃 조립 — 3-패널 + GlobalSearch + 상태바"
```

---

---

## Task 12: 코드 하이라이팅 + 가상 스크롤

**Files:**
- Modify: `src/renderer/src/components/ConversationView.tsx`

- [ ] **Step 1: rehype-highlight 설치**

```bash
npm install rehype-highlight
```

- [ ] **Step 2: ConversationView.tsx에서 하이라이팅 활성화**

파일 상단 import 추가:

```ts
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
```

메시지 렌더링 부분에서 `<ReactMarkdown>` 을 아래로 교체:

```tsx
<ReactMarkdown rehypePlugins={[rehypeHighlight]}>
  {msg.content}
</ReactMarkdown>
```

- [ ] **Step 3: 가상 스크롤 적용 (대용량 세션 대비)**

`ConversationView.tsx` 상단에 import 추가:

```ts
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
```

메시지 목록 렌더링을 가상 스크롤로 교체 (`.messages` div 내부):

```tsx
const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120,
  overscan: 5,
})

// JSX의 .messages div:
<div className="messages" ref={parentRef}>
  <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
    {virtualizer.getVirtualItems().map((virtualItem) => {
      const msg = messages[virtualItem.index]
      const isFocused = matchedIndices[matchIndex] === virtualItem.index
      return (
        <div
          key={msg.uuid}
          id={`msg-${msg.uuid}`}
          style={{ position: 'absolute', top: virtualItem.start, width: '100%' }}
          className={`message message-${msg.role} ${isFocused ? 'search-focused' : ''}`}
          ref={virtualizer.measureElement}
          data-index={virtualItem.index}
        >
          <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
          <div className="message-content">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{msg.content}</ReactMarkdown>
            {query && msg.content.toLowerCase().includes(query.toLowerCase()) && (
              <div className="message-highlighted">
                {highlightText(msg.content, query)}
              </div>
            )}
          </div>
        </div>
      )
    })}
  </div>
</div>
```

- [ ] **Step 4: 앱 실행 확인**

```bash
npm run dev
```

코드 블록이 포함된 세션을 열어서 문법 하이라이팅이 적용되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/components/ConversationView.tsx
git commit -m "feat: 코드 하이라이팅(rehype-highlight) + 가상 스크롤(@tanstack/react-virtual)"
```

---

## 완료 기준

- [ ] `npm run test:run` — 전체 통과
- [ ] `npm run dev` — 앱 실행, 실제 `~/.claude/projects/` 데이터 표시
- [ ] 프로젝트 → 세션 → 대화 드릴다운 동작
- [ ] `⌘K` 전체 검색 동작
- [ ] `⌘F` 세션 내 검색 + 하이라이트 + 결과 이동 동작
- [ ] .jsonl 파일 변경 시 자동 갱신
- [ ] 코드 블록 문법 하이라이팅 적용
- [ ] 대용량 세션에서 가상 스크롤 동작
