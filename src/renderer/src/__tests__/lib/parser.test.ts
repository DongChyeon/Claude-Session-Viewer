// src/renderer/src/__tests__/lib/parser.test.ts
import { describe, test, expect } from 'vitest'
import { parseSession } from '../../lib/parser'

describe('parseSession', () => {
  test('유저 메시지를 추출한다', () => {
    const raw = JSON.stringify({
      type: 'user',
      uuid: 'uuid-1',
      timestamp: '2026-04-07T03:00:00.000Z',
      message: { role: 'user', content: '안녕하세요' },
    })
    const messages = parseSession(raw)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('안녕하세요')
    expect(messages[0].uuid).toBe('uuid-1')
    expect(messages[0].timestamp).toBe('2026-04-07T03:00:00.000Z')
  })

  test('어시스턴트 메시지를 추출한다', () => {
    const raw = JSON.stringify({
      type: 'assistant',
      uuid: 'uuid-2',
      timestamp: '2026-04-07T03:01:00.000Z',
      message: { role: 'assistant', content: '안녕하세요!' },
    })
    const messages = parseSession(raw)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
  })

  test('메타 레코드(file-history-snapshot)는 제외된다', () => {
    const lines = [
      JSON.stringify({ type: 'file-history-snapshot', messageId: 'x', snapshot: {} }),
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-04-07T03:00:00.000Z', message: { content: '질문' } }),
    ].join('\n')
    const messages = parseSession(lines)
    expect(messages).toHaveLength(1)
  })

  test('손상된 JSON 줄은 건너뛴다', () => {
    const lines = [
      'NOT_JSON{{{',
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-04-07T03:00:00.000Z', message: { content: '정상' } }),
    ].join('\n')
    const messages = parseSession(lines)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('정상')
  })

  test('빈 문자열은 빈 배열을 반환한다', () => {
    expect(parseSession('')).toEqual([])
  })

  test('content가 배열인 경우 text 블록만 이어붙인다', () => {
    const raw = JSON.stringify({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-04-07T03:00:00.000Z',
      message: {
        content: [
          { type: 'text', text: '첫번째 ' },
          { type: 'tool_use', id: 'x' },
          { type: 'text', text: '두번째' },
        ],
      },
    })
    const messages = parseSession(raw)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('첫번째 두번째')
  })

  test('content가 없는 레코드는 제외된다', () => {
    const raw = JSON.stringify({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-04-07T03:00:00.000Z',
      message: { content: '' },
    })
    expect(parseSession(raw)).toHaveLength(0)
  })

  test('여러 줄을 순서대로 반환한다', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-04-07T03:00:00.000Z', message: { content: '첫번째' } }),
      JSON.stringify({ type: 'assistant', uuid: 'u2', timestamp: '2026-04-07T03:01:00.000Z', message: { content: '두번째' } }),
      JSON.stringify({ type: 'user', uuid: 'u3', timestamp: '2026-04-07T03:02:00.000Z', message: { content: '세번째' } }),
    ].join('\n')
    const messages = parseSession(lines)
    expect(messages).toHaveLength(3)
    expect(messages.map(m => m.content)).toEqual(['첫번째', '두번째', '세번째'])
  })
})
