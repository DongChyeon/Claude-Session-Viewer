import { useState, useEffect, useRef } from 'react'
import type { GlobalSearchResult } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onNavigate: (projectId: string, sessionId: string, messageUuid: string) => void
}

export function GlobalSearch({ isOpen, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const data = await window.api.globalSearch(query)
      setResults(data)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  return (
    <div className="global-search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="global-search-modal">
        <input
          ref={inputRef}
          type="text"
          placeholder="전체 세션 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="search-results">
          {results.map((r) => (
            <div
              key={`${r.sessionId}-${r.messageUuid}`}
              className="search-result-item"
              onClick={() => { onNavigate(r.projectId, r.sessionId, r.messageUuid); onClose() }}
            >
              <div className="result-meta">
                <span className="result-project">{r.projectName}</span>
                <span className="result-date">{new Date(r.sessionStartedAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="result-snippet">{r.snippet}</div>
            </div>
          ))}
          {query && results.length === 0 && (
            <div className="no-results">결과 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
