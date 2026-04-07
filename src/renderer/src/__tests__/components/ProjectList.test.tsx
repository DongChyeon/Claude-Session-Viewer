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
