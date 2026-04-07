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
