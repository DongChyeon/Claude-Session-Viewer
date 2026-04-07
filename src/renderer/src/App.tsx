import { useState, useEffect, useRef, useCallback } from 'react'
import { ProjectList } from './components/ProjectList'
import { SessionList } from './components/SessionList'
import { ConversationView } from './components/ConversationView'
import { GlobalSearch } from './components/GlobalSearch'
import { useSessions } from './hooks/useSessions'
import './App.css'

function usePanelResize(initial: number, min: number, max: number) {
  const [width, setWidth] = useState(initial)
  const widthRef = useRef(initial)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const minRef = useRef(min)
  const maxRef = useRef(max)

  useEffect(() => { widthRef.current = width }, [width])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = widthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const stopDrag = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      if (e.buttons === 0) { stopDrag(); return }
      const delta = e.clientX - startX.current
      setWidth(Math.min(maxRef.current, Math.max(minRef.current, startWidth.current + delta)))
    }
    const onMouseUp = () => { if (dragging.current) stopDrag() }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return { width, onMouseDown }
}

export function App() {
  const {
    projects, selectedProjectId, sessions, selectedSessionId,
    messages, watcherActive, totalSessions,
    selectProject, selectSession,
  } = useSessions()

  const [searchOpen, setSearchOpen] = useState(false)
  const project = usePanelResize(220, 120, 400)
  const session = usePanelResize(280, 160, 500)

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
          width={project.width}
        />
        <div className="resize-handle" onMouseDown={project.onMouseDown} />
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={selectSession}
          width={session.width}
        />
        <div className="resize-handle" onMouseDown={session.onMouseDown} />
        <ConversationView messages={messages} sessionId={selectedSessionId ?? undefined} />
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
