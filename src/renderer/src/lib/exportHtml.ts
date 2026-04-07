import type { Message } from '../types'

function markdownToHtml(md: string): string {
  const blocks: string[] = []

  // 1. 펜스드 코드 블록 추출 (플레이스홀더로 대체)
  let html = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const safeLang = lang.replace(/[^a-zA-Z0-9_-]/g, '')
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const idx = blocks.push(
      `<pre><code${safeLang ? ` class="language-${safeLang}"` : ''}>${escaped}</code></pre>`
    ) - 1
    return `\x00BLK${idx}\x00`
  })

  // 2. HTML 이스케이프 (코드 블록 제외한 나머지)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 3. 인라인 마크다운
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (_m, h, text) => `<h${h.length}>${text}</h${h.length}>`)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')

  // 4. 단락 / 줄바꿈
  html = html
    .split(/\n\n+/)
    .map(p => (p.startsWith('<h') || p.startsWith('\x00BLK') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`))
    .join('\n')

  // 5. 코드 블록 복원
  html = html.replace(/\x00BLK(\d+)\x00/g, (_m, i) => blocks[parseInt(i)])

  return html
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: false,
  })
}

export function generateHtml(messages: Message[], sessionStartedAt: string): string {
  const rows = messages.map(msg => {
    const isUser = msg.role === 'user'
    const align = isUser ? 'right' : 'left'
    const bubbleBg = isUser ? '#2d333b' : '#1c2b1c'
    const borderRadius = isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px'
    const avatar = isUser ? '👤' : '🤖'
    const time = new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const body = markdownToHtml(msg.content)

    return `
    <div class="message ${isUser ? 'user' : 'assistant'}">
      <div class="avatar">${avatar}</div>
      <div class="bubble" style="background:${bubbleBg};border-radius:${borderRadius};text-align:${align === 'right' ? 'left' : 'left'}">
        ${body}
        <div class="time">${time}</div>
      </div>
    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Session — ${formatDate(sessionStartedAt)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d1117; color: #f0f6fc; font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; }
  header { position: sticky; top: 0; background: #161b22; border-bottom: 1px solid #30363d; padding: 14px 24px; display: flex; align-items: center; gap: 12px; z-index: 10; }
  header h1 { font-size: 14px; color: #8b949e; font-weight: normal; }
  header .count { font-size: 12px; background: #21262d; color: #8b949e; padding: 2px 10px; border-radius: 10px; }
  .messages { max-width: 900px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 28px; }
  .message { display: flex; gap: 10px; align-items: flex-start; }
  .message.user { flex-direction: row-reverse; }
  .avatar { width: 30px; height: 30px; border-radius: 50%; background: #21262d; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
  .message.assistant .avatar { background: #1a2e1a; }
  .bubble { max-width: 75%; padding: 10px 14px; font-size: 13px; color: #f0f6fc; }
  .bubble p { margin: 6px 0; }
  .bubble p:first-child { margin-top: 0; }
  .bubble p:last-child { margin-bottom: 0; }
  .bubble h1,.bubble h2,.bubble h3,.bubble h4,.bubble h5,.bubble h6 { margin: 10px 0 6px; color: #e6edf3; }
  .bubble h1 { font-size: 16px; } .bubble h2 { font-size: 15px; } .bubble h3 { font-size: 14px; }
  .bubble strong { color: #e6edf3; }
  .bubble code { background: #161b22; border-radius: 3px; padding: 1px 5px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12px; color: #79c0ff; }
  .bubble pre { background: #161b22; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 8px 0; }
  .bubble pre code { background: none; padding: 0; color: #e6edf3; font-size: 12px; }
  .time { font-size: 10px; color: #6e7681; margin-top: 6px; }
  .message.user .time { text-align: right; }
</style>
</head>
<body>
<header>
  <span>🤖</span>
  <h1>Claude Session &mdash; ${formatDate(sessionStartedAt)}</h1>
  <span class="count">${messages.length} messages</span>
</header>
<div class="messages">
${rows}
</div>
</body>
</html>`
}
