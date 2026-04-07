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
