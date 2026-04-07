const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  const frameworksPath = path.join(appPath, 'Contents', 'Frameworks')

  console.log('\n========================================')
  console.log('[after-pack] START ad-hoc signing')
  console.log(`[after-pack] appPath: ${appPath}`)
  console.log('========================================\n')

  if (!fs.existsSync(appPath)) {
    console.log(`[after-pack] .app not found, skipping: ${appPath}`)
    return
  }

  const sign = (target) => {
    console.log(`  signing: ${path.relative(appPath, target)}`)
    // 오류 발생 시 즉시 throw (silent catch 제거)
    execSync(`codesign --force --sign - --timestamp=none "${target}"`, { stdio: 'pipe' })
  }

  const run = (cmd) => execSync(cmd, { shell: '/bin/bash', encoding: 'utf-8' })

  if (fs.existsSync(frameworksPath)) {
    // 1. 모든 .dylib
    run(`find "${frameworksPath}" -name "*.dylib" -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"`)

    // 2. Electron Framework — Versions/A 내부 바이너리 직접 서명
    const electronFw = path.join(frameworksPath, 'Electron Framework.framework')
    if (fs.existsSync(electronFw)) {
      const versA = path.join(electronFw, 'Versions', 'A')
      // 내부 라이브러리
      const libsDir = path.join(versA, 'Libraries')
      if (fs.existsSync(libsDir)) {
        run(`find "${libsDir}" -name "*.dylib" -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"`)
      }
      // Versions/A 내 실행 파일들
      const binaries = run(`find "${versA}" -maxdepth 1 -type f -perm +0111`).trim().split('\n').filter(Boolean)
      for (const b of binaries) sign(b)
      // Electron Framework 번들 전체 서명
      sign(electronFw)
    }

    // 3. 나머지 .framework 번들 (Electron Framework 제외)
    const otherFws = run(`find "${frameworksPath}" -maxdepth 2 -name "*.framework" ! -path "*Electron Framework*"`)
      .trim().split('\n').filter(Boolean)
    for (const fw of otherFws) sign(fw)

    // 4. Helper .app 번들
    const helpers = run(`find "${frameworksPath}" -maxdepth 3 -name "*.app"`)
      .trim().split('\n').filter(Boolean)
    for (const h of helpers) sign(h)
  }

  // 5. 메인 실행 파일
  run(`find "${appPath}/Contents/MacOS" -type f -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"`)

  // 6. 메인 앱 번들
  sign(appPath)

  // 7. 서명 결과 검증
  console.log('\n[after-pack] Verifying signatures...')
  const fwBin = path.join(appPath, 'Contents', 'Frameworks',
    'Electron Framework.framework', 'Versions', 'A', 'Electron Framework')
  if (fs.existsSync(fwBin)) {
    const info = execSync(`codesign -dv "${fwBin}" 2>&1 || true`, { shell: '/bin/bash', encoding: 'utf-8' })
    const teamLine = info.split('\n').find(l => l.includes('TeamIdentifier') || l.includes('Identifier'))
    console.log(`  Electron Framework: ${teamLine?.trim() ?? '(no team line found)'}`)
  }
  const appInfo = execSync(`codesign -dv "${appPath}" 2>&1 || true`, { shell: '/bin/bash', encoding: 'utf-8' })
  const appTeam = appInfo.split('\n').find(l => l.includes('TeamIdentifier') || l.includes('Identifier'))
  console.log(`  Main app:           ${appTeam?.trim() ?? '(no team line found)'}`)

  console.log('\n========================================')
  console.log('[after-pack] Ad-hoc signing COMPLETE')
  console.log('========================================\n')
}
