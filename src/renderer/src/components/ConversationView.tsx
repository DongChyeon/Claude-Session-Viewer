import { useState, useRef, useEffect } from 'react'
import type { Message } from '../types'
import { searchInSession } from '../lib/search'

interface Props {
  messages: Message[]
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const lower = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lower.indexOf(lowerQuery)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {highlightText(text.slice(idx + query.length), query)}
    </>
  )
}

export function ConversationView({ messages }: Props) {
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const matchedIndices = searchInSession(messages, query)
  const totalMatches = matchedIndices.length
  const currentMatch = totalMatches > 0 ? matchIndex + 1 : 0

  useEffect(() => { setMatchIndex(0) }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const goNext = () => setMatchIndex((i) => (i + 1) % totalMatches)
  const goPrev = () => setMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)

  if (messages.length === 0) {
    return <div className="panel conversation-view empty"><span>세션을 선택하세요</span></div>
  }

  return (
    <div className="panel conversation-view">
      {/* 세션 내 검색 바 */}
      <div className="in-session-search">
        <span className="search-icon">🔎</span>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="이 대화에서 검색... (⌘F)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
            if (e.key === 'Escape') setQuery('')
          }}
        />
        {totalMatches > 0 && (
          <span className="match-count">{currentMatch} / {totalMatches}</span>
        )}
        <button onClick={goPrev} disabled={totalMatches === 0}>↑</button>
        <button onClick={goNext} disabled={totalMatches === 0}>↓</button>
        {query && <button onClick={() => setQuery('')}>✕</button>}
      </div>

      {/* 메시지 목록 */}
      <div className="messages">
        {messages.map((msg, idx) => {
          const isFocused = matchedIndices[matchIndex] === idx
          const hasMatch = query && msg.content.toLowerCase().includes(query.toLowerCase())
          return (
            <div
              key={msg.uuid}
              id={`msg-${msg.uuid}`}
              className={`message message-${msg.role} ${isFocused ? 'search-focused' : ''}`}
            >
              <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="message-content">
                {hasMatch ? highlightText(msg.content, query) : msg.content}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
