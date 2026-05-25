# MindVault AI 助手工具接入规范

> 本规范适用于所有参与 MindVault 开发的 AI 编程助手和开发者。
> **核心原则：只要不篡改软件的持久化数据，所有用户级操作都应通过 AI 工具暴露给 AI 助手。**

---

## 1. 总则

### 1.1 工具接入强制要求

**每次新增用户可操作的功能时，必须同步在 `tool-executor.ts` 中注册对应的 AI 工具。**

这不是可选的优化，而是硬性开发规范。如果用户可以通过 UI 完成的操作，AI 助手也必须能通过工具调用完成。

### 1.2 数据安全红线

| 允许（AI 可操作） | 禁止（AI 不可操作） |
|---|---|
| 查询/读取任何数据 | 删除/修改用户的创意内容 |
| 切换设置/偏好 | 修改用户账号信息 |
| 打开/关闭功能开关 | 篡改数据库记录 |
| 触发 UI 展示（弹窗/通知） | 导出用户隐私数据 |
| 播放/暂停媒体 | 修改系统核心配置 |
| 创建新的用户内容 | 执行破坏性文件操作 |

**判断标准：如果该操作用户自己在 UI 上能一键完成，AI 也应该能通过工具完成。**

---

## 2. 工具注册流程

### 2.1 注册位置

所有 AI 工具统一定义在 `src/main/services/tool-executor.ts` 中：

```
1. 工具定义 → getToolDefinitions() 数组中添加工具 schema
2. 执行分发 → executeTool() 的 switch-case 中添加 case
3. 实现函数 → 文件底部添加 async handle 函数
```

### 2.2 工具定义规范

```typescript
{
  type: 'function',
  function: {
    name: '动词_名词',           // 如 get_weather、toggle_alerts
    description: '清晰描述功能和触发场景，包含用户可能说的话',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '参数说明' },
      },
      required: ['param1'],      // 必填参数
    },
  },
}
```

**命名规范：**
- 查询类：`get_xxx`（获取天气、获取定位信息）
- 切换类：`toggle_xxx`（开关预警、开关播报）
- 设置类：`set_xxx`（设置时间、设置模式）
- 触发类：`trigger_xxx`（触发通知、触发检查）
- 操作类：`open_xxx` / `close_xxx` / `start_xxx` / `stop_xxx`

### 2.3 工具实现规范

```typescript
async function handleXxx(args: any): Promise<string> {
  try {
    // 1. 参数校验
    if (!args.xxx) return '错误提示';

    // 2. 执行操作（在主进程直接完成，不依赖渲染进程回传）
    const result = await doSomething(args);

    // 3. 通知渲染进程更新 UI（如需要）
    notifyRenderer('channel', { data });

    // 4. 返回人类可读的结果文本（AI 会直接展示给用户）
    return `操作成功：${result}`;
  } catch (err) {
    return `操作失败：${err.message}`;
  }
}
```

**关键原则：**
- **工具函数必须直接返回真实数据**，不能返回 "正在获取..." 之类的占位文本
- 数据获取应在主进程完成（使用 Node.js 的 `https`/`fs` 等模块），不依赖渲染进程
- 如需更新 UI，通过 IPC 通知渲染进程（`mainWindow.webContents.send`）

---

## 3. 数据通信架构

### 3.1 正确模式（推荐）

```
AI 调用工具 → 主进程直接获取数据 → 返回真实结果给 AI
                    ↓
              IPC 通知渲染进程 → 更新 UI
```

```typescript
// ✅ 正确：主进程直接获取数据
async function handleGetWeather() {
  const data = await WeatherService.fetchCurrentWeather(); // 主进程 HTTP 请求
  WeatherService.notifyRenderer('weather:ai-response', { action: 'show', data }); // 通知 UI
  return `当前温度：${data.temperature}°C`; // 返回真实数据
}
```

### 3.2 错误模式（禁止）

```
AI 调用工具 → 发 IPC 给渲染进程 → 立即返回占位文本 → AI 收到假数据
                    ↓
              渲染进程获取数据 → 只更新 UI → 数据无法回传给 AI
```

```typescript
// ❌ 错误：Fire-and-Forget 模式
async function handleGetWeather() {
  mainWindow.webContents.send('weather:get-current');
  return '正在获取当前天气信息...'; // AI 永远收到这个占位文本！
}
```

### 3.2 IPC 通道命名规范

| 通道模式 | 命名格式 | 用途 |
|---|---|---|
| AI → 渲染（操作结果） | `weather:ai-response` | AI 工具执行完后通知渲染进程弹出 UI |
| AI → 渲染（设置变更） | `weather:toggle-alerts` | AI 修改用户设置后通知渲染进程同步 |
| AI → 渲染（打开 UI） | `weather:open-city-selector` | AI 请求打开某个 UI 组件 |

---

## 4. 各模块工具接入检查清单

新增功能时，对照此清单确保 AI 工具已完整接入：

- [ ] 工具定义已添加到 `getToolDefinitions()` 数组
- [ ] case 分支已添加到 `executeTool()` 的 switch 中
- [ ] 工具函数在主进程直接获取数据，返回真实结果
- [ ] 需要更新 UI 时通过 IPC 通知渲染进程
- [ ] 渲染进程已监听对应的 IPC 通道
- [ ] 工具 description 包含用户可能的自然语言表述
- [ ] 参数校验完整，错误信息清晰
- [ ] 不涉及数据篡改（符合安全红线）

---

## 5. 已接入工具清单

### 天气系统
| 工具名 | 功能 | 返回真实数据 |
|---|---|---|
| `get_weather` | 获取当前天气 | ✅ |
| `get_weather_forecast` | 获取天气预报 | ✅ |
| `get_weather_alerts` | 获取天气预警 | ✅ |
| `toggle_weather_alerts` | 开关预警 | ✅ |
| `set_weather_briefing_time` | 设置播报时间 | ✅ |
| `show_daily_weather_briefing` | 显示每日播报 | ✅ |
| `set_weather_location_mode` | 切换定位模式 | ✅ |
| `open_city_selector` | 打开城市选择器 | ✅ |
| `get_current_weather_location` | 获取定位信息 | ✅ |
| `trigger_forecast_notification` | 即时触发预报通知 | ✅ |
| `trigger_alert_notification` | 即时触发预警通知 | ✅ |

### 其他系统
（后续新增功能时在此补充）

---

## 6. 常见错误与修复

### 错误 1：AI 说"操作成功"但实际没生效
**原因**：工具函数只发了 IPC 没有执行实际操作
**修复**：在主进程直接执行操作，IPC 仅用于通知 UI 更新

### 错误 2：AI 返回"正在获取..."占位文本
**原因**：工具函数使用 Fire-and-Forget 模式
**修复**：使用 `await` 等待数据获取完成后再 return

### 错误 3：AI 操作后 UI 没有变化
**原因**：渲染进程没有监听对应的 IPC 通道
**修复**：在 Home.tsx 或对应组件中添加 `onMenuEvent` 监听
