# 应用图标说明

本目录用于存放Electron应用的图标文件。

## 所需图标格式

### Windows
- `icon.ico` - 256x256 像素的ICO格式图标

### macOS
- `icon.icns` - 包含多种尺寸的ICNS格式图标
  - 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024

### Linux
- `icon.png` - 512x512 像素的PNG格式图标

## 图标设计建议

1. 使用简洁的设计，确保在小尺寸下清晰可见
2. 保持与GitHub品牌风格一致
3. 建议使用深色背景配亮色图标，或反之

## 如何生成图标

可以使用以下工具生成多平台图标：

1. **在线工具**
   - https://icon.kitchen - 生成多平台图标
   - https://convertico.com - PNG转ICO

2. **命令行工具**
   - `electron-icon-builder` - 自动生成多平台图标
   - `png2icns` - PNG转ICNS

## 临时图标

如果暂时没有图标文件，electron-builder会使用默认图标。
建议在正式发布前添加自定义图标。
