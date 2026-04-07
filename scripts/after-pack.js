const { execSync } = require('child_process')
const path = require('path')

/**
 * electron-builder afterPack 훅 — macOS ad-hoc 코드 서명
 *
 * Apple Developer 계정 없이 배포할 때 Electron Framework의 Team ID와
 * 앱의 Team ID 불일치로 크래시가 발생한다.
 * '-' (ad-hoc) 서명으로 전체를 다시 서명하면 Team ID 검사를 우회할 수 있다.
 */
exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`\n[after-pack] Ad-hoc signing: ${appPath}`)
  execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' })
  console.log('[after-pack] Ad-hoc signing complete.\n')
}
