# Claude Session Viewer — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

---

## Overview

`~/.claude/projects/` 에 저장된 클로드 세션 파일(.jsonl)을 탐색·검색·열람할 수 있는 Electron 데스크톱 앱.

---

## Goals

- 프로젝트별 세션 목록 탐색 및 대화 내용 열람
- 전체 세션 키워드 검색 (⌘K)
- 세션 내 인라인 키워드 검색 (⌘F)
- 파일 변경 실시간 감지 및 자동 반영

---

## Architecture

```
claude-session-viewer/
├── electron/
│   ├── main.ts          # Electron 메인 프로세스, BrowserWindow 생성
│   ├── preload.ts       # contextBridge로 IPC API 노출
│   └── watcher.ts       # fs.watch로 ~/.claude/projects/ 재귀 감시
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── ProjectList.tsx       # 왼쪽 패널: 프로젝트 목록
│   │   ├── SessionList.tsx       # 가운데 패널: 세션 목록
│   │   └── ConversationView.tsx  # 오른쪽 패널: 대화 내용 + 세션 내 검색
│   ├── hooks/
│   │   └── useSessions.ts        # IPC 통신 + 전역 상태 관리
│   └── lib/
│       ├── parser.ts     # .jsonl 파싱 → 메시지 객체 변환
│       └── search.ts     # 전체 검색 인덱스 구축 및 쿼리
└── vite.config.ts
```

**데이터 흐름:**

1. 메인 프로세스가 `~/.claude/projects/` 를 재귀 감시 (`fs.watch`)
2. 파일 변경 감지 시 IPC 이벤트 `session:updated` 로 렌더러에 알림
3. 렌더러는 IPC 호출(`session:getAll`, `session:getMessages`)로 데이터 요청
4. 메인 프로세스가 `.jsonl` 읽고 파싱 후 응답

---

## Data Model

```ts
// 프로젝트 = ~/.claude/projects/ 내 각 디렉토리
interface Project {
  id: string       // 디렉토리명 (예: "-Users-donghyeon-AndroidStudioProjects-album-id-changer-and")
  name: string     // 표시용 이름 (마지막 세그먼트)
  path: string     // 실제 프로젝트 경로 (디렉토리명 역변환)
  sessions: Session[]
}

// 세션 = .jsonl 파일 하나
interface Session {
  id: string           // UUID (파일명에서 추출)
  projectId: string
  startedAt: Date      // 첫 메시지 타임스탬프
  messageCount: number
  preview: string      // 첫 사용자 메시지 앞 100자
}

// 메시지 = .jsonl 한 줄에서 추출
interface Message {
  uuid: string
  role: 'user' | 'assistant'
  content: string   // 텍스트만 추출 (tool_use 등 메타 레코드 제외)
  timestamp: Date
}
```

**파싱 규칙:** `.jsonl` 각 줄에서 `type === 'user'` 또는 `type === 'assistant'` 인 항목만 추출. `file-history-snapshot` 등 메타 레코드는 무시.

---

## UI Layout

**기본 윈도우 크기:** 1400×900

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 전체 세션 검색... (⌘K)            25 projects · 127 sessions │
├────────────┬──────────────┬────────────────────────────────┤
│  PROJECTS  │   SESSIONS   │  🔎 이 대화에서 검색... (⌘F)  │
│            │              ├────────────────────────────────┤
│  album-id  │  Apr 7 3:04  │  👤 리팩토링 해줘              │
│  amp-core  │  Apr 6 11:22 │                                │
│  billboard │  Apr 5 7:45  │  🤖 네, 파일을 읽어볼게요...  │
│  BuyOrNot  │  ...         │  ```kotlin                     │
│  ...       │              │  class UserRepository { ... }  │
│            │              │  ```                           │
│            │              │                                │
├────────────┴──────────────┴────────────────────────────────┤
│  ● 파일 감시 중   25개 프로젝트 · 127개 세션   ~/.claude/projects/ │
└─────────────────────────────────────────────────────────────┘
```

### ProjectList (왼쪽, 220px)
- `~/.claude/projects/` 디렉토리 목록 표시
- 디렉토리명에서 표시용 이름 추출 (마지막 `-` 구분 세그먼트)
- 선택 시 SessionList 업데이트

### SessionList (가운데, 280px)
- 선택된 프로젝트의 세션 목록, 최신 순 정렬
- 각 항목: 날짜/시간, 첫 메시지 미리보기, 메시지 수
- 선택 시 ConversationView 업데이트

### ConversationView (오른쪽, flex)
- 상단 고정: 세션 내 검색 바 (⌘F로 포커스, ↑↓ / Enter로 이동, "N/전체" 표시)
- 대화 메시지 렌더링: `react-markdown` + 코드 하이라이팅
- 검색 매칭 텍스트: 노란색 하이라이트, 현재 포커스: 파란 테두리
- 대용량 세션 대비 가상 스크롤 적용

### 전체 검색 (⌘K)
- 모달 오버레이로 표시
- 세션 로드 시 인메모리 인덱스 구축
- 결과 클릭 시 해당 프로젝트 > 세션 > 메시지 위치로 이동

---

## Error Handling

| 상황 | 처리 방식 |
|------|-----------|
| 파일 읽기 실패 (권한, 손상) | 해당 세션만 목록에서 제외, 무음 처리 |
| 파일 감시 중단 | 상태바에 "● 감시 중단됨" 표시, 클릭 시 재시작 |
| 대용량 세션 (수천 메시지) | 가상 스크롤로 렌더링 성능 확보 |

---

## Tech Stack

| 항목 | 선택 |
|------|------|
| 플랫폼 | Electron |
| UI 프레임워크 | React + TypeScript |
| 빌드 도구 | Vite |
| 마크다운 렌더링 | react-markdown |
| 코드 하이라이팅 | highlight.js 또는 shiki |
| 가상 스크롤 | @tanstack/react-virtual |
| 파일 감시 | Node.js `fs.watch` (메인 프로세스) |
| 테스트 프레임워크 | Vitest (lib/), React Testing Library (components/) |

---

## Testing Strategy (TDD)

**개발 방식:** Red → Green → Refactor 사이클로 진행.

**테스트 함수명:** 한글로 작성. 예시:

```ts
test('유저 메시지와 어시스턴트 메시지만 추출한다', () => { ... })
test('메타 레코드는 파싱 결과에서 제외된다', () => { ... })
test('손상된 JSON 줄은 건너뛴다', () => { ... })
```

**테스트 대상 및 범위:**

| 대상 | 테스트 내용 |
|------|------------|
| `parser.ts` | .jsonl 파싱, 메타 레코드 제외, 손상 줄 처리 |
| `search.ts` | 인덱스 구축, 키워드 검색, 대소문자 무시, 빈 쿼리 처리 |
| `ProjectList` | 프로젝트 목록 렌더링, 선택 상태 반영 |
| `SessionList` | 세션 목록 최신순 정렬, 미리보기 표시 |
| `ConversationView` | 메시지 렌더링, 세션 내 검색 하이라이트, 결과 이동 |

UI 컴포넌트는 IPC 의존성을 mock으로 대체하여 렌더러 단에서 독립 테스트.
