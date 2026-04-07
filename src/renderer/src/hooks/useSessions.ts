// src/renderer/src/hooks/useSessions.ts
import { useState, useEffect, useCallback } from 'react'
import type { Project, Session, Message } from '../types'

export function useSessions() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [watcherActive, setWatcherActive] = useState(true)

  const loadProjects = useCallback(async () => {
    try {
      const data = await window.api.getProjects()
      setProjects(data)
    } catch {
      setWatcherActive(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
    const unsubscribe = window.api.onSessionUpdated(() => {
      loadProjects()
      if (selectedProjectId) {
        window.api.getSessions(selectedProjectId).then(setSessions).catch(() => {})
      }
    })
    return unsubscribe
  }, [loadProjects, selectedProjectId])

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedSessionId(null)
    setMessages([])
    const data = await window.api.getSessions(projectId)
    setSessions(data)
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    if (!selectedProjectId) return
    setSelectedSessionId(sessionId)
    const data = await window.api.getMessages(selectedProjectId, sessionId)
    setMessages(data)
  }, [selectedProjectId])

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
