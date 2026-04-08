# UX Visibility Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ConversationView` 상단에 헤더 바를 추가해 HTML 내보내기·터미널 재개를 검색 바에서 분리하고, 세션 제목을 첫 사용자 메시지 기반으로 표시한다.

**Architecture:** `ConversationView.tsx`에 `conversation-header` 영역을 추가해 액션 버튼(내보내기·터미널 셀렉트·재개)을 이동시키고, `in-session-search`는 순수 검색 컨트롤만 남긴다. `extractTitle` 순수 함수를 컴포넌트 파일 내에 인라인으로 추가한다.

**Tech Stack:** React, TypeScript, CSS (CSS Variables), Vitest, React Testing Library

---

## File Map

| 파일 | 작업 |
|------|------|
| `src/renderer/src/App.css` | 신규 CSS 클래스 4개 추가 |
| `src/renderer/src/components/ConversationView.tsx` | `conversation-header` 추가, `extractTitle` 함수 추가, `in-session-search` 정리 |
| `src/renderer/src/__tests__/components/ConversationView.test.tsx` | `conversation-header` 관련 테스트 추가, `window.api` mock 보강 |
| `src/renderer/src/__tests__/setup.ts` | `window.api` 전역 mock 추가 |

---

## Task 1: window.api mock 추가 및 기존 테스트 통과 확인

기존 `ConversationView` 테스트는 `window.api`를 mock하지 않아 `getPlatform()` useEffect가 silently 실패한다. 새 헤더 테스트에서 `window.api`가 필요하므로 setup에 추가한다.

**Files:**
- Modify: `src/renderer/src/__tests__/setup.ts`

- [ ] **Step 1: 기존 테스트 실행 — 현재 상태 확인**

```bash
cd /Users/donghyeon/claude-session-viewer
npx vitest run src/renderer/src/__tests__/components/ConversationView.test.tsx 2>&1 | tail -20
```

Expected: 테스트가 통과하거나 `window.api` 관련 에러 확인

- [ ] **Step 2: setup.ts에 window.api mock 추가**

`src/renderer/src/__tests__/setup.ts` 전체를 아래로 교체:

```ts
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
```

- [ ] **Step 3: 기존 테스트 재실행 — 여전히 통과하는지 확인**

```bash
npx vitest run src/renderer/src/__tests__/components/ConversationView.test.tsx 2>&1 | tail -20
```

Expected: 7개 테스트 모두 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/renderer/src/__tests__/setup.ts
git commit -m "test: add window.api mock to test setup"
```

---

## Task 2: extractTitle 함수 테스트 작성 (Red)

`extractTitle`은 순수 함수이므로 컴포넌트와 별개로 단위 테스트한다. 아직 구현 전이라 실패해야 한다.

**Files:**
- Modify: `src/renderer/src/__tests__/components/ConversationView.test.tsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`ConversationView.test.tsx` 파일 상단 import 아래에 다음 import를 추가하고, 파일 끝에 새 describe 블록을 추가:

```ts
// 파일 상단 import 뒤에 추가
import { extractTitle } from '../../components/ConversationView'
```

파일 끝 (마지막 `}` 뒤)에 추가:

```ts
describe('extractTitle', () => {
  test('첫 번째 유저 메시지의 첫 줄을 제목으로 반환한다', () => {
    const msgs: Message[] = [
      { uuid: 'u1', role: 'user', content: '첫 줄입니다\n두 번째 줄', timestamp: '2026-04-08T00:00:00.000Z' },
    ]
    expect(extractTitle(msgs)).toBe('첫 줄입니다')
  })

  test('첫 번째 유저 메시지의 첫 문장을 제목으로 반환한다', () => {
    const msgs: Message[] = [
      { uuid: 'u1', role: 'user', content: '리팩토링 해줘. 나머지 내용', timestamp: '2026-04-08T00:00:00.000Z' },
    ]
    expect(extractTitle(msgs)).toBe('리팩토링 해줘')
  })

  test('첫 줄이 첫 문장보다 짧으면 첫 줄을 반환한다', () => {
    const msgs: Message[] = [
      { uuid: 'u1', role: 'user', content: '짧은 줄\n긴 문장입니다. 계속됩니다', timestamp: '2026-04-08T00:00:00.000Z' },
    ]
    expect(extractTitle(msgs)).toBe('짧은 줄')
  })

  test('60자를 초과하면 잘라낸다', () => {
    const long = 'a'.repeat(80)
    const msgs: Message[] = [
      { uuid: 'u1', role: 'user', content: long, timestamp: '2026-04-08T00:00:00.000Z' },
    ]
    expect(extractTitle(msgs)).toHaveLength(60)
  })

  test('첫 번째 어시스턴트 메시지만 있으면 타임스탬프 폴백을 반환한다', () => {
    const msgs: Message[] = [
      { uuid: 'u1', role: 'assistant', content: '안녕하세요', timestamp: '2026-04-08T00:00:00.000Z' },
    ]
    const result = extractTitle(msgs)
    // 타임스탬프 기반 locale 문자열 — 비어있지 않으면 통과
    expect(result.length).toBeGreaterThan(0)
  })

  test('빈 메시지 배열이면 빈 문자열을 반환한다', () => {
    expect(extractTitle([])).toBe('')
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/renderer/src/__tests__/components/ConversationView.test.tsx 2>&1 | grep -E "FAIL|extractTitle|export"
```

Expected: `extractTitle is not exported` 또는 `is not a function` 에러로 FAIL

- [ ] **Step 3: 커밋 (Red 상태)**

```bash
git add src/renderer/src/__tests__/components/ConversationView.test.tsx
git commit -m "test: add extractTitle unit tests (red)"
```

---

## Task 3: extractTitle 구현 (Green)

**Files:**
- Modify: `src/renderer/src/components/ConversationView.tsx`

- [ ] **Step 1: ConversationView.tsx에 extractTitle 함수 추가**

파일 최상단 import 블록 바로 뒤 (함수 선언 전)에 추가:

```ts
export function extractTitle(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')?.content ?? ''
  if (!first) return messages[0] ? new Date(messages[0].timestamp).toLocaleString() : ''
  const line = first.split('\n')[0]
  const sentence = first.split(/[.?!。]/)[0]
  const raw = line.length <= sentence.length ? line : sentence
  return raw.trim().slice(0, 60) || new Date(messages[0].timestamp).toLocaleString()
}
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/renderer/src/__tests__/components/ConversationView.test.tsx 2>&1 | tail -20
```

Expected: 모든 테스트 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/renderer/src/components/ConversationView.tsx
git commit -m "feat: add extractTitle function for session header"
```

---

## Task 4: conversation-header 테스트 작성 (Red)

**Files:**
- Modify: `src/renderer/src/__tests__/components/ConversationView.test.tsx`

- [ ] **Step 1: conversation-header 테스트 추가**

`ConversationView.test.tsx`의 기존 `describe('ConversationView', ...)` 블록 내부 끝에 추가:

```ts
  test('세션이 선택되면 첫 유저 메시지 기반 제목을 헤더에 표시한다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    expect(screen.getByText('Kotlin 리팩토링 해줘')).toBeInTheDocument()
    expect(document.querySelector('.conversation-header')).toBeInTheDocument()
  })

  test('헤더에 HTML 내보내기 버튼이 있다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    expect(document.querySelector('.conversation-header .export-btn')).toBeInTheDocument()
  })

  test('헤더에 터미널 레이블이 있다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    expect(screen.getByText('터미널:')).toBeInTheDocument()
  })

  test('헤더에 재개 버튼이 있다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    expect(document.querySelector('.conversation-header .resume-btn')).toBeInTheDocument()
  })

  test('검색 바에 HTML 내보내기 버튼이 없다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    const searchBar = document.querySelector('.in-session-search')
    expect(searchBar?.querySelector('.export-btn')).toBeNull()
  })

  test('검색 바에 터미널 셀렉트가 없다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    const searchBar = document.querySelector('.in-session-search')
    expect(searchBar?.querySelector('.terminal-select')).toBeNull()
  })

  test('메시지가 없으면 conversation-header를 렌더링하지 않는다', () => {
    render(<ConversationView messages={[]} />)
    expect(document.querySelector('.conversation-header')).toBeNull()
  })
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/renderer/src/__tests__/components/ConversationView.test.tsx 2>&1 | grep -E "FAIL|conversation-header|헤더"
```

Expected: 신규 테스트 FAIL (`.conversation-header` 없음)

- [ ] **Step 3: 커밋 (Red 상태)**

```bash
git add src/renderer/src/__tests__/components/ConversationView.test.tsx
git commit -m "test: add conversation-header tests (red)"
```

---

## Task 5: CSS 클래스 추가

**Files:**
- Modify: `src/renderer/src/App.css`

- [ ] **Step 1: App.css에 신규 클래스 추가**

`App.css` 파일의 `/* ConversationView */` 섹션 바로 앞에 추가:

```css
/* Conversation Header */
.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 8px;
}

.conversation-title {
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.terminal-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/renderer/src/App.css
git commit -m "style: add conversation-header CSS classes"
```

---

## Task 6: conversation-header 렌더링 구현 (Green)

**Files:**
- Modify: `src/renderer/src/components/ConversationView.tsx`

- [ ] **Step 1: ConversationView.tsx의 return문 수정**

현재 return문의 `<div className="panel conversation-view">` 내부를 아래와 같이 수정:

현재:
```tsx
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
        <button className="export-btn" onClick={handleExport} title="HTML로 내보내기">↓ HTML</button>
        {sessionId && (
          <>
            <select
              className="terminal-select"
              value={terminal}
              onChange={(e) => handleTerminalChange(e.target.value)}
              title="터미널 선택"
            >
              {terminalOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              className="resume-btn"
              onClick={async () => {
                const err = await window.api.resumeSession(sessionId, terminal)
                if (err) alert(`세션 재개 실패\n\n${err}`)
              }}
              title={`claude --resume ${sessionId}`}
            >
              ▶ 재개
            </button>
          </>
        )}
      </div>
```

변경 후:
```tsx
  return (
    <div className="panel conversation-view">
      {/* 대화 헤더: 제목 + 액션 버튼 */}
      <div className="conversation-header">
        <span className="conversation-title">{extractTitle(messages)}</span>
        <div className="header-actions">
          <button className="export-btn" onClick={handleExport} title="HTML로 내보내기">↓ HTML</button>
          {sessionId && (
            <>
              <span className="terminal-label">터미널:</span>
              <select
                className="terminal-select"
                value={terminal}
                onChange={(e) => handleTerminalChange(e.target.value)}
                title="터미널 선택"
              >
                {terminalOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                className="resume-btn"
                onClick={async () => {
                  const err = await window.api.resumeSession(sessionId, terminal)
                  if (err) alert(`세션 재개 실패\n\n${err}`)
                }}
                title={`claude --resume ${sessionId}`}
              >
                ▶ 재개
              </button>
            </>
          )}
        </div>
      </div>

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
```

- [ ] **Step 2: 전체 테스트 실행 — 통과 확인**

```bash
npx vitest run src/renderer/src/__tests__/components/ConversationView.test.tsx 2>&1 | tail -25
```

Expected: 모든 테스트 PASS

- [ ] **Step 3: 전체 테스트 스위트 실행 — 회귀 확인**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: 전체 PASS (실패 0)

- [ ] **Step 4: 커밋**

```bash
git add src/renderer/src/components/ConversationView.tsx
git commit -m "feat: add conversation-header with title, export, and resume actions"
```

---

## Task 7: App.css 미사용 클래스 정리

헤더로 이동하면서 `in-session-search` 내에서 `export-btn`, `terminal-select`, `resume-btn`의 `.in-session-search` 부모 관련 위치 지정 CSS가 있는지 확인하고 불필요한 것 제거.

**Files:**
- Modify: `src/renderer/src/App.css`

- [ ] **Step 1: App.css에서 관련 선언 확인**

현재 `App.css`에서 `export-btn`, `terminal-select`, `resume-btn`의 스타일 선언 위치 확인:

```bash
grep -n "export-btn\|terminal-select\|resume-btn" src/renderer/src/App.css
```

Expected 출력:
```
77:.export-btn { margin-left: 4px; color: var(--accent) !important; border-color: var(--accent) !important; }
78:.export-btn:hover { background: rgba(88,166,255,0.1) !important; }
79:.terminal-select { margin-left: 4px; ... }
81:.resume-btn { margin-left: 4px; ... }
```

- [ ] **Step 2: margin-left: 4px 제거 (header-actions의 gap: 4px이 대신 처리)**

`App.css`에서 `.export-btn`, `.terminal-select`, `.resume-btn`의 `margin-left: 4px` 선언을 제거:

```css
/* 변경 전 */
.export-btn { margin-left: 4px; color: var(--accent) !important; border-color: var(--accent) !important; }
.terminal-select { margin-left: 4px; background: var(--bg-primary); color: var(--text-secondary); border: 1px solid var(--border); border-radius: 5px; padding: 2px 6px; font-size: 12px; cursor: pointer; }
.resume-btn { margin-left: 4px; background: var(--accent); color: #fff; border: none; border-radius: 5px; padding: 3px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }

/* 변경 후 */
.export-btn { color: var(--accent) !important; border-color: var(--accent) !important; }
.terminal-select { background: var(--bg-primary); color: var(--text-secondary); border: 1px solid var(--border); border-radius: 5px; padding: 2px 6px; font-size: 12px; cursor: pointer; }
.resume-btn { background: var(--accent); color: #fff; border: none; border-radius: 5px; padding: 3px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
```

- [ ] **Step 3: 전체 테스트 재실행 — 회귀 없음 확인**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: 전체 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/renderer/src/App.css
git commit -m "style: remove margin-left from action buttons (header-actions gap handles spacing)"
```
