import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.githubstars.desktop',
  productName: 'GitHub Stars',
  copyright: 'Copyright © 2024 GitHub Stars',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  files: [
    'out/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: '../../packages/frontend/dist',
      to: 'frontend-dist',
      filter: ['**/*']
    }
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'build/icon.ico',
    artifactName: '${productName}-${version}-Setup.${ext}'
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'build/icon.icns',
    category: 'public.app-category.developer-tools',
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      }
    ],
    icon: 'build/icon.png',
    category: 'Development',
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'GitHub Stars'
  },
  publish: {
    provider: 'github',
    owner: 'wanzicong',
    repo: 'githubstars',
    releaseType: 'release'
  }
}

export default config
