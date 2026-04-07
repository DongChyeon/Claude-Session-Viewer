// src/renderer/src/types.ts

export interface Project {
  id: string        // 디렉토리명 (예: "-Users-donghyeon-AndroidStudioProjects-foo")
  name: string      // 표시용 이름 (예: "foo")
  path: string      // 실제 경로 (예: "/Users/donghyeon/AndroidStudioProjects/foo")
  sessionCount: number
}

export interface Session {
  id: string           // UUID (파일명에서 확장자 제거)
  projectId: string
  startedAt: string    // ISO 8601 문자열 (IPC 직렬화를 위해 Date 대신 string)
  messageCount: number
  preview: string      // 첫 사용자 메시지 앞 100자
}

export interface Message {
  uuid: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string    // ISO 8601 문자열
}

export interface GlobalSearchResult {
  projectId: string
  sessionId: string
  projectName: string
  sessionStartedAt: string
  messageUuid: string
  role: 'user' | 'assistant'
  snippet: string   // 매칭 전후 30자 포함
  query: string
}

// preload에서 window.api로 노출되는 IPC API 타입
export interface ElectronAPI {
  getProjects: () => Promise<Project[]>
  getSessions: (projectId: string) => Promise<Session[]>
  getMessages: (projectId: string, sessionId: string) => Promise<Message[]>
  globalSearch: (query: string) => Promise<GlobalSearchResult[]>
  exportHtml: (html: string, defaultName: string) => Promise<boolean>
  resumeSession: (sessionId: string) => Promise<void>
  onSessionUpdated: (callback: () => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
