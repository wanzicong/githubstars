const { spawn } = require('child_process');
const path = require('path');

// 启动 Electron 并进入开发模式
const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');
const electron = spawn(electronPath, ['.', '--dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
  shell: true,
});

electron.on('close', (code: number | null) => {
  console.log(`Electron 退出，代码: ${code}`);
  process.exit(code || 0);
});
