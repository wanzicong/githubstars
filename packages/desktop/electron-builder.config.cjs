const config = {
  appId: 'com.githubstars.desktop',
  // monorepo 中 electron 提升到根 node_modules，需显式指定版本
  electronVersion: '33.4.11',
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
    // 前端构建产物
    {
      from: '../../packages/frontend/dist',
      to: 'frontend-dist',
      filter: ['**/*']
    },
    // 后端服务（由 bundle-backend.mjs 生成）
    {
      from: 'build/backend-bundle',
      to: 'backend',
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
    artifactName: '${productName}-${version}-Setup.${ext}',
    // Windows 本地打包无需代码签名
    signDlls: false,
    signAndEditExecutable: false
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

module.exports = config
