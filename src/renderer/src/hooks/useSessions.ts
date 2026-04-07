// src/renderer/src/hooks/useSessions.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Project, Session, Message } from '../types'

export function useSessions() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [watcherActive, setWatcherActive] = useState(true)

  const selectedProjectIdRef = useRef<string | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      const data = await window.api.getProjects()
      setProjects(data)
    } catch {
      setWatcherActive(false)
    }
  }, [])

  // 초기 로드
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 파일 변경 감시 구독 (한 번만)
  useEffect(() => {
    const unsubscribe = window.api.onSessionUpdated(() => {
      loadProjects()
      if (selectedProjectIdRef.current) {
        window.api.getSessions(selectedProjectIdRef.current).then(setSessions).catch(() => {})
      }
    })
    return unsubscribe
  }, [loadProjects])

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    selectedProjectIdRef.current = projectId
    setSelectedSessionId(null)
    setMessages([])
    const data = await window.api.getSessions(projectId)
    setSessions(data)
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    if (!selectedProjectIdRef.current) return
    setSelectedSessionId(sessionId)
    const data = await window.api.getMessages(selectedProjectIdRef.current, sessionId)
    setMessages(data)
  }, [])

  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0)

  return {
    projects,
    selectedProjectId,
    sessions,
    selectedSessionId,
    messages,
    watcherActive,
    totalSessions,
    selectProject,
    selectSession,
  }
}
