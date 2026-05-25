export interface FontEntry {
  family: string;
  label: string;
  source: 'builtin' | 'custom';
  filePath?: string;
  fileName?: string;
  format?: string;
  fallback: string;
}

const BUILTIN_FONTS: FontEntry[] = [
  { family: 'MindVault-Title', label: '喜脉体', source: 'builtin', fallback: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { family: 'MindVault-Body', label: '圆体', source: 'builtin', fallback: "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif" },
  { family: 'MindVault-Special', label: '玄宗体', source: 'builtin', fallback: 'serif' },
  { family: 'MindVault-English', label: 'NamskowWhite', source: 'builtin', fallback: 'sans-serif' },
  { family: 'MindVault-Extend-Songti', label: '侯尊宋体', source: 'builtin', fallback: 'serif' },
  { family: 'MindVault-Extend-Kaiti', label: '寒蝉正楷体', source: 'builtin', fallback: 'serif' },
  { family: 'MindVault-Extend-Heiti', label: '文泉驿正黑', source: 'builtin', fallback: 'sans-serif' },
];

const SYSTEM_FONTS: FontEntry[] = [
  { family: 'PingFang SC', label: '苹方', source: 'builtin', fallback: "'Microsoft YaHei', sans-serif" },
  { family: 'Microsoft YaHei', label: '微软雅黑', source: 'builtin', fallback: 'sans-serif' },
  { family: 'SimSun', label: '宋体', source: 'builtin', fallback: 'serif' },
  { family: 'SimHei', label: '黑体', source: 'builtin', fallback: 'sans-serif' },
  { family: 'KaiTi', label: '楷体', source: 'builtin', fallback: 'serif' },
  { family: 'FangSong', label: '仿宋', source: 'builtin', fallback: 'serif' },
];

let customFonts: FontEntry[] = [];

export function getAllFonts(): FontEntry[] {
  return [...BUILTIN_FONTS, ...SYSTEM_FONTS, ...customFonts];
}

export function getBuiltinFonts(): FontEntry[] {
  return BUILTIN_FONTS;
}

export function getSystemFonts(): FontEntry[] {
  return SYSTEM_FONTS;
}

export function getCustomFonts(): FontEntry[] {
  return customFonts;
}

export function loadCustomFontsFromSettings(customFontsJson: string): void {
  try {
    const parsed = JSON.parse(customFontsJson || '[]');
    if (Array.isArray(parsed)) {
      customFonts = parsed.filter((f: any) => f.family && f.label);
      customFonts.forEach(registerFontFace);
    }
  } catch {
    customFonts = [];
  }
}

export function addCustomFont(entry: FontEntry): void {
  const exists = customFonts.some(f => f.family === entry.family);
  if (!exists) {
    customFonts.push(entry);
    registerFontFace(entry);
  }
}

export function removeCustomFont(family: string): FontEntry | undefined {
  const idx = customFonts.findIndex(f => f.family === family);
  if (idx >= 0) {
    const removed = customFonts.splice(idx, 1)[0];
    return removed;
  }
  return undefined;
}

export function serializeCustomFonts(): string {
  return JSON.stringify(customFonts);
}

function registerFontFace(entry: FontEntry): void {
  if (entry.source !== 'custom' || !entry.filePath) return;
  try {
    const format = entry.format || guessFormat(entry.fileName || entry.filePath);
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: '${entry.family}'; src: url('file://${entry.filePath}') format('${format}'); font-weight: normal; font-style: normal; font-display: swap; }`;
    document.head.appendChild(style);
  } catch {
    // silent
  }
}

function guessFormat(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.otf')) return 'opentype';
  if (lower.endsWith('.woff2')) return 'woff2';
  if (lower.endsWith('.woff')) return 'woff';
  return 'truetype';
}

export function buildFontValue(family: string, fallback: string): string {
  const needsQuotes = /[\s-]/.test(family) && !family.startsWith("'") && !family.startsWith('"');
  const quoted = needsQuotes ? `'${family}'` : family;
  return `${quoted}, ${fallback}`;
}

export function parseFontFamily(fontValue: string): string {
  if (!fontValue) return '';
  const first = fontValue.split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
}

export function findFontByFamily(family: string): FontEntry | undefined {
  return getAllFonts().find(f => f.family === family);
}

export async function importFontFiles(filePaths: string[], onProgress?: (current: number, total: number, entry: FontEntry) => void): Promise<FontEntry[]> {
  const imported: FontEntry[] = [];
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    try {
      const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const family = `Custom-${baseName}`;
      const format = guessFormat(fileName);
      const entry: FontEntry = {
        family,
        label: baseName,
        source: 'custom',
        filePath,
        fileName,
        format,
        fallback: 'sans-serif',
      };
      addCustomFont(entry);
      imported.push(entry);
      if (onProgress) onProgress(i + 1, filePaths.length, entry);
    } catch {
      // skip failed
    }
  }
  return imported;
}
