import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { readdir, readFile, writeFile, chmod } from 'fs/promises'
import { spawn } from 'child_process'
import { startWatcher } from './watcher'
import type { Project, Session, Message, GlobalSearchResult } from '../renderer/src/types'

// parser 로직 (main process에서 직접 실행 — electron-vite는 main/renderer 별도 번들)
interface ContentBlock { type: string; text?: string }
function extractText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content.filter(b => b.type === 'text' && b.text).map(b => b.text!).join('')
}
function parseJsonl(raw: string): Message[] {
  const messages: Message[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      if (r.type !== 'user' && r.type !== 'assistant') continue
      const content = extractText(r.message?.content ?? '')
      if (!content.trim()) continue
      messages.push({
        uuid: r.uuid ?? crypto.randomUUID(),
        role: r.type,
        content,
        timestamp: r.timestamp ?? new Date().toISOString(),
      })
    } catch { /* 건너뜀 */ }
  }
  return messages
}

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  startWatcher(PROJECTS_DIR, mainWindow)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// IPC: 프로젝트 목록
ipcMain.handle('session:getProjects', async (): Promise<Project[]> => {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true })
    const projects: Project[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dirName = entry.name
      // 디렉토리명은 "/" → "-" 인코딩. 앞의 "-" 제거 후 "/" 복원
      const decoded = '/' + dirName.replace(/^-/, '').replace(/-/g, '/')
      const name = decoded
      const sessionFiles = (await readdir(join(PROJECTS_DIR, dirName))).filter(f => f.endsWith('.jsonl'))
      if (sessionFiles.length === 0) continue
      projects.push({ id: dirName, name, path: decoded, sessionCount: sessionFiles.length })
    }
    return projects.sort((a, b) => a.path.localeCompare(b.path))
  } catch { return [] }
})

// IPC: 세션 목록
ipcMain.handle('session:getSessions', async (_e, projectId: string): Promise<Session[]> => {
  const dir = join(PROJECTS_DIR, projectId)
  try {
    const files = (await readdir(dir)).filter(f => f.endsWith('.jsonl'))
    const sessions: Session[] = []
    for (const file of files) {
      try {
        const raw = await readFile(join(dir, file), 'utf-8')
        const messages = parseJsonl(raw)
        if (messages.length === 0) continue
        const firstUser = messages.find(m => m.role === 'user')
        sessions.push({
          id: file.replace('.jsonl', ''),
          projectId,
          startedAt: messages[0].timestamp,
          messageCount: messages.length,
          preview: firstUser ? firstUser.content.slice(0, 100) : '',
        })
      } catch { /* 손상된 파일 건너뜀 */ }
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  } catch { return [] }
})

// IPC: 메시지 목록
ipcMain.handle('session:getMessages', async (_e, projectId: string, sessionId: string): Promise<Message[]> => {
  try {
    const raw = await readFile(join(PROJECTS_DIR, projectId, `${sessionId}.jsonl`), 'utf-8')
    return parseJsonl(raw)
  } catch { return [] }
})

// IPC: HTML 내보내기
ipcMain.handle('session:exportHtml', async (_e, html: string, defaultName: string): Promise<boolean> => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    defaultPath: defaultName,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })
  if (canceled || !filePath) return false
  try {
    await writeFile(filePath, html, 'utf-8')
  } catch { return false }
  const openError = await shell.openPath(filePath)
  if (openError) console.error('shell.openPath failed:', openError)
  return true
})

// IPC: 플랫폼 정보
ipcMain.handle('session:getPlatform', () => process.platform)

// osascript 실행 헬퍼 (단일 구문 또는 구문 배열)
function runAppleScript(lines: string | string[]): Promise<string | null> {
  const args = (Array.isArray(lines) ? lines : [lines]).flatMap(l => ['-e', l])
  return new Promise((resolve) => {
    const proc = spawn('osascript', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => resolve(code === 0 ? null : `터미널을 열 수 없습니다.\n${stderr.trim()}`))
    proc.on('error', (err: Error) => resolve(`터미널을 열 수 없습니다.\n${err.message}`))
  })
}

// spawn 단발 실행 헬퍼 (detached)
function spawnDetached(prog: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(prog, args, { detached: true, stdio: 'ignore' })
    child.on('spawn', () => { child.unref(); resolve(null) })
    child.on('error', (err: Error) => resolve(`터미널을 열 수 없습니다.\n${err.message}`))
  })
}

// IPC: 터미널에서 세션 재개 — 성공 시 null, 실패 시 에러 메시지 반환
ipcMain.handle('session:resume', async (_e, sessionId: string, terminal: string): Promise<string | null> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId)) {
    return '유효하지 않은 세션 ID입니다.'
  }

  const cmd = `claude --resume ${sessionId}`

  // macOS
  if (process.platform === 'darwin') {
    switch (terminal) {
      case 'iterm2':
        // tell...end tell 블록: 딕셔너리 컨텍스트 안에서 'window' 클래스명 파싱 오류 방지
        return runAppleScript([
          'tell application "iTerm2"',
          `  create window with default profile command "${cmd}"`,
          'end tell',
        ])
      case 'warp':
        // Warp는 CLI 인자로 명령 실행 미지원 — URL scheme 사용
        return spawnDetached('open', [`warp://action/new_tab?command=${encodeURIComponent(cmd)}`])
      case 'ghostty': {
        // open --args 는 args를 별개 토큰으로 전달하므로
        // bash -c "claude --resume uuid" 의 cmd 부분이 분리되어 claude 만 실행됨.
        // 또한 open -na 로 열린 쉘은 로그인 쉘이 아니라 PATH 미설정.
        // → 임시 스크립트 파일에 명령과 profile 소스를 기록해 단일 경로로 전달.
        const tmpScript = join(app.getPath('temp'), `claude-resume-${sessionId}.sh`)
        await writeFile(tmpScript, [
          '#!/bin/bash',
          '[ -f ~/.zprofile ]     && source ~/.zprofile',
          '[ -f ~/.bash_profile ] && source ~/.bash_profile',
          '[ -f ~/.profile ]      && source ~/.profile',
          cmd,
          'exec $SHELL',
        ].join('\n'))
        await chmod(tmpScript, 0o755)
        return spawnDetached('open', ['-na', 'Ghostty', '--args', '-e', tmpScript])
      }
      default: // 'terminal' (Terminal.app)
        return runAppleScript(`tell application "Terminal" to do script "${cmd}"`)
    }
  }

  // Windows
  if (process.platform === 'win32') {
    switch (terminal) {
      case 'powershell':
        return spawnDetached('powershell.exe', ['-NoExit', '-Command', cmd])
      case 'cmd':
        return new Promise((resolve) => {
          const child = spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', cmd], { stdio: 'ignore' })
          child.on('spawn', () => { child.unref(); resolve(null) })
          child.on('error', (err: Error) => resolve(`터미널을 열 수 없습니다.\n${err.message}`))
        })
      default: // 'wt' (Windows Terminal)
        return spawnDetached('wt.exe', ['new-tab', '--', 'cmd', '/k', cmd])
    }
  }

  // Linux
  switch (terminal) {
    case 'konsole':
      return spawnDetached('konsole', ['-e', 'bash', '-c', `${cmd}; exec bash`])
    case 'xterm':
      return spawnDetached('xterm', ['-e', 'bash', '-c', `${cmd}; exec bash`])
    case 'kitty':
      return spawnDetached('kitty', ['bash', '-c', `${cmd}; exec bash`])
    default: // 'gnome-terminal'
      return spawnDetached('gnome-terminal', ['--', 'bash', '-c', `${cmd}; exec bash`])
  }
})

// IPC: 전체 검색
ipcMain.handle('session:globalSearch', async (_e, query: string): Promise<GlobalSearchResult[]> => {
  if (!query.trim()) return []
  const lower = query.toLowerCase()
  const results: GlobalSearchResult[] = []
  try {
    const projectDirs = (await readdir(PROJECTS_DIR, { withFileTypes: true }))
      .filter(e => e.isDirectory())
    for (const pd of projectDirs) {
      const dir = join(PROJECTS_DIR, pd.name)
      const files = (await readdir(dir)).filter(f => f.endsWith('.jsonl'))
      const decoded = '/' + pd.name.replace(/^-/, '').replace(/-/g, '/')
      const name = decoded
      for (const file of files) {
        try {
          const raw = await readFile(join(dir, file), 'utf-8')
          const messages = parseJsonl(raw)
          const sessionId = file.replace('.jsonl', '')
          const startedAt = messages[0]?.timestamp ?? ''
          for (const m of messages) {
            if (!m.content.toLowerCase().includes(lower)) continue
            const idx = m.content.toLowerCase().indexOf(lower)
            const start = Math.max(0, idx - 30)
            const end = Math.min(m.content.length, idx + query.length + 30)
            results.push({
              projectId: pd.name,
              sessionId,
              projectName: name,
              sessionStartedAt: startedAt,
              messageUuid: m.uuid,
              role: m.role,
              snippet: m.content.slice(start, end),
              query,
            })
          }
        } catch { /* 건너뜀 */ }
      }
    }
  } catch { /* 건너뜀 */ }
  return results.slice(0, 200)
})
