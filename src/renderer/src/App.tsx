import { useState, useEffect } from 'react'
import { ProjectList } from './components/ProjectList'
import { SessionList } from './components/SessionList'
import { ConversationView } from './components/ConversationView'
import { GlobalSearch } from './components/GlobalSearch'
import { useSessions } from './hooks/useSessions'
import './App.css'

export function App() {
  const {
    projects, selectedProjectId, sessions, selectedSessionId,
    messages, watcherActive, totalSessions,
    selectProject, selectSession,
  } = useSessions()

  const [searchOpen, setSearchOpen] = useState(false)

  // ⌘K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleNavigate = (projectId: string, sessionId: string) => {
    selectProject(projectId).then(() => selectSession(sessionId))
  }

  return (
    <div className="app">
      {/* 상단 전체 검색 바 */}
      <div className="top-bar" onClick={() => setSearchOpen(true)}>
        <span className="search-icon">🔍</span>
        <span className="search-placeholder">전체 세션 검색... (⌘K)</span>
        <span className="stats">{projects.length} projects · {totalSessions} sessions</span>
      </div>

      {/* 3-패널 */}
      <div className="panels">
        <ProjectList
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={selectProject}
        />
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={selectSession}
        />
        <ConversationView messages={messages} />
      </div>

      {/* 하단 상태바 */}
      <div className="status-bar">
        <span className={`watcher-status ${watcherActive ? 'active' : 'inactive'}`}>
          ● {watcherActive ? '파일 감시 중' : '감시 중단됨'}
        </span>
        <span>{projects.length}개 프로젝트 · {totalSessions}개 세션</span>
        <span className="projects-dir">~/.claude/projects/</span>
      </div>

      {/* 전체 검색 모달 */}
      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(projectId, sessionId, _messageUuid) => handleNavigate(projectId, sessionId)}
      />
    </div>
  )
}

export default App
