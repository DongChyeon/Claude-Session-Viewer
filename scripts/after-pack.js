const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

/**
 * electron-builder afterPack 훅 — macOS ad-hoc 코드 서명
 *
 * codesign --deep 은 Electron Framework의 버전화된 내부 구조를 제대로 처리하지 못한다.
 * 안(dylib) → 중간(framework, helper) → 바깥(main app) 순서로 직접 서명해야 한다.
 */
exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  const frameworksPath = path.join(appPath, 'Contents', 'Frameworks')

  console.log(`\n[after-pack] Ad-hoc signing: ${appPath}`)

  const sign = (target) => {
    try {
      execSync(`codesign --force --sign - --timestamp=none "${target}"`, { stdio: 'pipe' })
    } catch (e) {
      console.warn(`  [warn] sign failed: ${path.basename(target)}`, e.stderr?.toString().trim())
    }
  }

  const sh = (cmd) => execSync(cmd, { shell: '/bin/bash', stdio: 'pipe' })

  if (!fs.existsSync(frameworksPath)) {
    sign(appPath)
    return
  }

  // 1. 모든 dylib 서명
  sh(`find "${frameworksPath}" -name "*.dylib" -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"`)

  // 2. Electron Framework 내부 바이너리 직접 서명 (버전화 구조 대응)
  const electronFw = path.join(frameworksPath, 'Electron Framework.framework')
  if (fs.existsSync(electronFw)) {
    const versionsA = path.join(electronFw, 'Versions', 'A')
    // 내부 실행 파일
    const mainBin = path.join(versionsA, 'Electron Framework')
    if (fs.existsSync(mainBin)) sign(mainBin)
    // Versions/A/Libraries 안의 dylib
    const libsPath = path.join(versionsA, 'Libraries')
    if (fs.existsSync(libsPath)) {
      sh(`find "${libsPath}" -name "*.dylib" -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"`)
    }
    // Electron Framework 번들 전체
    sign(electronFw)
  }

  // 3. 나머지 .framework 번들
  const otherFws = sh(`find "${frameworksPath}" -maxdepth 2 -name "*.framework" ! -path "*Electron Framework*"`)
    .toString().trim().split('\n').filter(Boolean)
  for (const fw of otherFws) sign(fw)

  // 4. Helper .app 번들 (안에서 밖으로)
  const helpers = sh(`find "${frameworksPath}" -maxdepth 3 -name "*.app"`)
    .toString().trim().split('\n').filter(Boolean)
  for (const helper of helpers.sort((a, b) => b.length - a.length)) sign(helper)

  // 5. 실행 파일
  sh(`find "${appPath}/Contents/MacOS" -type f -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"`)

  // 6. 메인 앱 번들
  sign(appPath)

  console.log('[after-pack] Ad-hoc signing complete.\n')
}
