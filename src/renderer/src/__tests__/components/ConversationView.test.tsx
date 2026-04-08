import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationView } from '../../components/ConversationView'
import { extractTitle } from '../../components/ConversationView'
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

  test('세션이 선택되면 첫 유저 메시지 기반 제목을 헤더에 표시한다', () => {
    render(<ConversationView messages={메시지들} sessionId="test-session" />)
    expect(document.querySelector('.conversation-header')).toBeInTheDocument()
    expect(document.querySelector('.conversation-title')).toBeInTheDocument()
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
})

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
    expect(result.length).toBeGreaterThan(0)
  })

  test('빈 메시지 배열이면 빈 문자열을 반환한다', () => {
    expect(extractTitle([])).toBe('')
  })
})
