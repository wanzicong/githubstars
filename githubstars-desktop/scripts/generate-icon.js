const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const SIZES = [256, 128, 64, 48, 32, 16];
const SVG_PATH = path.join(__dirname, '..', 'resources', 'icon.svg');
const ICO_PATH = path.join(__dirname, '..', 'resources', 'icon.ico');

async function generateIcon() {
  console.log('🎨 开始生成图标...');

  const svgBuffer = fs.readFileSync(SVG_PATH);

  const pngBuffers = [];
  for (const size of SIZES) {
    console.log(`  生成 ${size}x${size} PNG...`);
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(pngBuffer);
  }

  console.log('  🖼️ 合并为 ICO...');
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(ICO_PATH, icoBuffer);

  const icoSize = fs.statSync(ICO_PATH).size;
  console.log(`✅ 图标生成完成: ${ICO_PATH} (${(icoSize / 1024).toFixed(1)} KB)`);
  console.log(`   包含尺寸: ${SIZES.join('x')}px`);
}

generateIcon().catch((err) => {
  console.error('❌ 图标生成失败:', err);
  process.exit(1);
});
