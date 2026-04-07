// src/renderer/src/lib/parser.ts
import type { Message } from '../types'

interface ContentBlock {
  type: string
  text?: string
}

function extractText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('')
}

export function parseSession(raw: string): Message[] {
  const messages: Message[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line)
      if (record.type !== 'user' && record.type !== 'assistant') continue
      const content = extractText(record.message?.content ?? '')
      if (!content.trim()) continue
      messages.push({
        uuid: record.uuid ?? crypto.randomUUID(),
        role: record.type as 'user' | 'assistant',
        content,
        timestamp: record.timestamp ?? new Date().toISOString(),
      })
    } catch {
      // 손상된 줄 건너뜀
    }
  }
  return messages
}
