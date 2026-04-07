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
