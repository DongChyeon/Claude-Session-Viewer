# UX Visibility Improvements — Design Spec

**Date:** 2026-04-08  
**Status:** Approved

---

## Overview

`ConversationView`의 HTML 내보내기, 터미널 재개, 세션 내 검색 기능의 시인성을 개선한다.  
현재 세 기능이 한 줄 툴바에 혼재되어 HTML 내보내기와 터미널 재개가 묻혀 있다.

---

## Goals

- HTML 내보내기 버튼을 검색 바 밖으로 분리해 독립적으로 노출
- 터미널 셀렉트에 레이블을 추가해 선택 가능한 UI임을 명확히
- 세션 제목을 날짜 대신 첫 사용자 메시지 기반 요약으로 표시
- 검색 바는 순수 검색 컨트롤만 남겨 역할 명확화

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  리팩토링 해줘         [⬇ HTML]  터미널: [Ghostty ▾]  [▶ 재개]  │  ← conversation-header (신규)
├─────────────────────────────────────────────────────────────┤
│  🔎 이 대화에서 검색...  [1/5]  [↑] [↓] [✕]                 │  ← in-session-search (정리)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (메시지 목록)                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### `conversation-header` (신규)

세션이 선택된 상태에서만 렌더링. 빈 상태(`messages.length === 0`)에서는 표시하지 않음.

**좌측 — 세션 제목**

- 첫 사용자 메시지(`role === 'user'`)의 content에서 추출
- 규칙: 첫 줄(`\n` 기준)과 첫 문장(`.`, `?`, `!`, `。` 기준) 중 짧은 쪽, 최대 60자
- 추출 결과가 빈 문자열이면 `messages[0].timestamp`를 `toLocaleString()`으로 폴백
- 스타일: `font-size: 13px`, `color: var(--text-secondary)`, 말줄임(`text-overflow: ellipsis`)

**우측 — 액션 그룹**

| 요소 | 설명 |
|------|------|
| `⬇ HTML` 버튼 | 기존 `export-btn` 스타일 재사용. `handleExport` 로직 그대로 이동 |
| `터미널:` 레이블 | `<label>` 또는 `<span>` 텍스트, `font-size: 11px`, `color: var(--text-muted)` |
| `<select>` (터미널 셀렉트) | 기존 `terminal-select` 클래스 재사용 |
| `▶ 재개` 버튼 | 기존 `resume-btn` 클래스 재사용 |

레이블+셀렉트+버튼은 `gap: 4px`의 flex 컨테이너로 묶어 하나의 액션 그룹으로 시각화.

### `in-session-search` (기존, 정리)

다음 요소를 제거하고 검색 컨트롤만 남긴다:

- `export-btn` (`↓ HTML` 버튼) → `conversation-header`로 이동
- `terminal-select` (`<select>`) → `conversation-header`로 이동
- `resume-btn` (`▶ 재개` 버튼) → `conversation-header`로 이동

남는 요소: `🔎` 아이콘, `<input>`, `match-count`, `↑` `↓` `✕` 버튼

---

## Title Extraction Logic

`ConversationView.tsx` 내 인라인 순수 함수로 구현. 별도 모듈 불필요.

```ts
function extractTitle(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')?.content ?? ''
  const line = first.split('\n')[0]
  const sentence = first.split(/[.?!。]/)[0]
  const raw = line.length <= sentence.length ? line : sentence
  return raw.trim().slice(0, 60) || new Date(messages[0]?.timestamp).toLocaleString()
}
```

---

## CSS Changes

### 신규 클래스

```css
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

### 기존 클래스 (변경 없음)

`export-btn`, `terminal-select`, `resume-btn` — 스타일 그대로 재사용.

---

## Affected Files

| 파일 | 변경 내용 |
|------|-----------|
| `src/renderer/src/components/ConversationView.tsx` | `conversation-header` 추가, `in-session-search`에서 액션 요소 제거, `extractTitle` 함수 추가 |
| `src/renderer/src/App.css` | 신규 CSS 클래스 4개 추가 |

---

## Out of Scope

- 전체 검색(⌘K) 상단 바 스타일 변경
- AI 기반 세션 요약
- 터미널 셀렉트 기본값 변경 로직
