// src/main/watcher.ts
import { watch, FSWatcher } from 'fs'
import { BrowserWindow } from 'electron'

let watcher: FSWatcher | null = null

export function startWatcher(projectsDir: string, win: BrowserWindow): void {
  stopWatcher()
  try {
    watcher = watch(projectsDir, { recursive: true }, (_event, _filename) => {
      if (!win.isDestroyed()) {
        win.webContents.send('session:updated')
      }
    })
  } catch {
    // 디렉토리가 없으면 감시 건너뜀
  }
}

export function stopWatcher(): void {
  watcher?.close()
  watcher = null
}
