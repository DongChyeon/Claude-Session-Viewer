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
