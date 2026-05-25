# 🎨 脑洞集 - 素材资源库

这里存放着项目使用的所有图片、图标和装饰素材！

## 📁 目录结构

```
images/
├── icons/                    # 图标资源
│   ├── logo-icon.svg        # Logo 图标（主色调渐变）
│   ├── creativity-icon.svg  # 创意图标
│   ├── home-icon.svg        # 首页图标
│   ├── search-icon.svg      # 搜索图标
│   └── star-icon.svg        # 星标图标
├── illustrations/            # 插画素材
│   ├── empty-state.svg      # 空状态插画
│   └── welcome-banner.svg   # 欢迎横幅
└── backgrounds/             # 背景素材
    ├── deco-pattern.svg     # 装饰图案背景
    └── gradient-shapes.svg  # 渐变形状背景
```

## 🎯 使用方式

### 1. 在 CSS 中使用背景

```css
.my-component {
  background-image: url('/images/backgrounds/deco-pattern.svg');
  background-repeat: repeat;
}
```

### 2. 在 React 中使用 SVG 图标

```tsx
import React from 'react';

const MyIcon = () => (
  <img 
    src="/images/icons/logo-icon.svg" 
    alt="Logo" 
    style={{ width: 24, height: 24 }}
  />
);
```

### 3. 使用装饰 CSS 类

项目已经内置了装饰类，直接使用即可：

```tsx
<div className="deco-bg-pattern">
  {/* 内容 */}
</div>

<div className="icon-wrapper">
  {/* 图标 */}
</div>
```

## 🎨 装饰 CSS 类速查表

| 类名 | 用途 |
|------|------|
| `deco-bg-pattern` | 装饰图案背景 |
| `deco-gradient-shapes` | 渐变形状背景（右下角） |
| `deco-float-blob` | 浮动渐变 blob（配合 position 使用） |
| `deco-particle` | 闪烁粒子装饰 |
| `icon-wrapper` | 精美的图标容器 |
| `deco-divider` | 装饰性分隔线 |
| `text-deco-gradient` | 渐变文字 |
| `card-deco-glow` | 卡片光晕装饰 |

## 📝 设计规范

### 配色
- 主色：`#6C63FF` - `#8B85FF` 渐变
- 成功色：`#10B981` - `#34D399`
- 信息色：`#3B82F6` - `#60A5FA`
- 警告色：`#F59E0B` - `#FBBF24`

### 文件格式
- 图标：使用 SVG，保证清晰度
- 插画：使用 SVG，可缩放
- 背景：使用 SVG，轻量快速

## 📥 更多素材来源

项目还可以使用以下网站素材：

1. **iconfont.cn** - 阿里巴巴矢量图标库
2. **yesicon.app** - 全球精选免费图标
3. **miankoutupian.com** - 免抠图片素材
4. **ant-design.antgroup.com** - Ant Design 设计参考

---

💡 建议：下载新素材后，也放入对应的目录中！
