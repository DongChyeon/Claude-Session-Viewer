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
