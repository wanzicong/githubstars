// 独立启动 Express 服务器（用于开发调试，不依赖 Electron）
import { startServer } from './index';

const PORT = parseInt(process.env.SERVER_PORT || '6002');

startServer({ preferredPort: PORT }).then(({ port, dbPath }) => {
  console.log(`🚀 服务器已启动`);
  console.log(`   - 端口: ${port}`);
  console.log(`   - 数据库: ${dbPath}`);
  console.log(`   - 健康检查: http://localhost:${port}/api/health`);
}).catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
