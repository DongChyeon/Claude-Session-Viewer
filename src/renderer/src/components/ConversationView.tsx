import { useState, useRef, useEffect, useMemo } from 'react'
import type { Message } from '../types'
import { searchInSession } from '../lib/search'
import { generateHtml } from '../lib/exportHtml'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { useVirtualizer } from '@tanstack/react-virtual'

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
  const listRef = useRef<HTMLDivElement>(null)

  const matchedIndices = useMemo(() => searchInSession(messages, query), [messages, query])
  const totalMatches = matchedIndices.length
  const currentMatch = totalMatches > 0 ? matchIndex + 1 : 0

  useEffect(() => { setMatchIndex(0) }, [query, messages])

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

  const handleExport = async () => {
    try {
      const startedAt = messages[0]?.timestamp ?? new Date().toISOString()
      const html = generateHtml(messages, startedAt)
      const date = new Date(startedAt).toISOString().slice(0, 10)
      const saved = await window.api.exportHtml(html, `claude-session-${date}.html`)
      if (saved === false) return
    } catch {
      alert('HTML 내보내기에 실패했습니다.')
    }
  }

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 120,
    overscan: 20,
  })

  // 현재 매치 위치로 스크롤
  useEffect(() => {
    if (totalMatches === 0) return
    const targetIndex = matchedIndices[matchIndex]
    if (targetIndex !== undefined) {
      virtualizer.scrollToIndex(targetIndex, { align: 'center' })
    }
  }, [matchIndex, matchedIndices, totalMatches, virtualizer])

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
        <button className="export-btn" onClick={handleExport} title="HTML로 내보내기">↓ HTML</button>
      </div>

      {/* 메시지 목록 */}
      <div className="messages" ref={listRef}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const msg = messages[virtualItem.index]
            const isFocused = matchedIndices[matchIndex] === virtualItem.index
            const hasMatch = query && msg.content.toLowerCase().includes(query.toLowerCase())
            return (
              <div
                key={msg.uuid}
                id={`msg-${msg.uuid}`}
                style={{
                  position: 'absolute',
                  top: virtualItem.start,
                  width: '100%',
                  paddingBottom: '24px',
                }}
                className={`message message-${msg.role} ${isFocused ? 'search-focused' : ''}`}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
              >
                <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                <div className="message-content">
                  {hasMatch
                    ? highlightText(msg.content, query)
                    : <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{msg.content}</ReactMarkdown>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
