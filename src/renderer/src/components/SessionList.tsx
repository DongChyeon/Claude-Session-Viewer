import type { Session } from '../types'

interface Props {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: false,
  })
}

export function SessionList({ sessions, selectedId, onSelect }: Props) {
  return (
    <div className="panel session-list">
      <div className="panel-header">SESSIONS · {sessions.length}</div>
      {sessions.length === 0 && (
        <div className="empty-state">세션이 없습니다</div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          className={`session-item ${s.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(s.id)}
        >
          <div className="session-date" data-testid="session-date">{formatDate(s.startedAt)}</div>
          <div className="session-preview">{s.preview}</div>
          <div className="session-count">{s.messageCount}</div>
        </div>
      ))}
    </div>
  )
}
