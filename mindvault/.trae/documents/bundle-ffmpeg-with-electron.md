# 计划：将 ffmpeg 打包到 Electron 应用中

## 问题背景

当前项目的视频缩略图生成依赖系统 PATH 中的 ffmpeg。如果用户没有安装 ffmpeg：

* **主进程 ffmpeg 方案失效**：无法生成持久化的缩略图文件

* **Canvas Fallback 仍可用**：浏览器端截帧可以临时显示缩略图，但不持久化、每次启动都要重新生成、格式兼容性受限

**目标**：将 ffmpeg 二进制文件打包到应用中，使用户无需单独安装 ffmpeg。

## 实施方案

使用 `ffmpeg-static` npm 包，它提供了预编译的 ffmpeg 二进制文件，会根据平台自动选择正确的二进制。

### 步骤 1：安装 ffmpeg-static

```bash
npm install ffmpeg-static
```

`ffmpeg-static` 会在安装时下载对应平台的 ffmpeg 二进制文件，通过 `require('ffmpeg-static')` 即可获取其路径。

### 步骤 2：修改 videoThumbnail.ts

修改 [src/main/utils/videoThumbnail.ts](file:///d:/Android/Code/naodong/mindvault/src/main/utils/videoThumbnail.ts) 中的 `checkFfmpeg` 和 `extractThumbnail` 函数：

1. **引入 ffmpeg-static**：获取打包的 ffmpeg 路径作为首选
2. **修改 checkFfmpeg**：优先使用 ffmpeg-static 提供的路径，如果不可用再回退到系统 PATH
3. **修改 extractThumbnail**：使用检测到的 ffmpeg 路径执行命令（而非硬编码 `'ffmpeg'`）

核心逻辑变更：

```
检测 ffmpeg 路径的优先级：
1. ffmpeg-static 提供的打包路径（应用内置）
2. 系统 PATH 中的 ffmpeg（用户自行安装）
3. 都不可用 → 返回 null，触发 Canvas fallback
```

### 步骤 3：更新 electron-builder 配置

修改 [package.json](file:///d:/Android/Code/naodong/mindvault/package.json) 中的 `build` 配置：

在 `extraResources` 中添加 ffmpeg-static 的二进制文件，确保打包后应用能正确找到 ffmpeg：

```json
"extraResources": [
  {
    "from": "node_modules/better-sqlite3/build",
    "to": "better-sqlite3/build"
  },
  {
    "from": "node_modules/ffmpeg-static/${os}-${arch}",
    "to": "ffmpeg-static",
    "filter": ["ffmpeg*"]
  }
]
```

### 步骤 4：处理 ASAR 兼容性

当前项目 `asar: false`，所以 ffmpeg 二进制文件可以直接被执行。如果未来启用 ASAR，需要确保 ffmpeg 二进制文件被排除在 ASAR 包之外（通过 `asarUnpack` 配置）。

### 步骤 5：验证测试

1. 在开发模式下验证 ffmpeg-static 路径是否正确解析
2. 模拟无系统 ffmpeg 的环境，验证内置 ffmpeg 是否正常工作
3. 运行 `npm run build` 验证打包后的应用是否包含 ffmpeg

## 注意事项

* `ffmpeg-static` 会增加约 50-80MB 的包体积（Windows x64 的 ffmpeg 二进制约 70MB）

* 当前项目仅构建 Windows x64，无需考虑跨平台二进制

* `ffmpeg-static` 的二进制文件在 `node_modules/ffmpeg-static/` 下，格式为 `win32-x64/ffmpeg.exe`

