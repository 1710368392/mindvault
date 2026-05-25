// @ts-nocheck
/**
 * RAG 智能分块服务
 * 短内容不分块，长内容按段落智能分块
 */

// 默认配置
const DEFAULT_CONFIG = {
  maxChunkSize: 500,      // 最大分块大小（字符）
  minChunkSize: 50,       // 最小分块大小
  overlapSize: 50,        // 重叠大小
  respectParagraphs: true, // 是否尊重段落边界
  respectSentences: true,  // 是否尊重句子边界
};

/**
 * 分块结果
 * @typedef {Object} Chunk
 * @property {string} text - 分块文本
 * @property {string} type - 分块类型：full（完整）、paragraph（段落）、sentence（句子）、overlap（重叠）
 * @property {number} index - 分块索引
 * @property {number} start - 起始位置
 * @property {number} end - 结束位置
 */

/**
 * 智能分块
 * @param {string} content - 要分块的内容
 * @param {object} options - 分块选项
 * @returns {Chunk[]}
 */
function smartChunk(content, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const { maxChunkSize, minChunkSize, overlapSize, respectParagraphs, respectSentences } = config;

  if (!content || content.trim().length === 0) {
    return [];
  }

  const trimmedContent = content.trim();

  // 短内容不分块
  if (trimmedContent.length <= maxChunkSize) {
    return [{
      text: trimmedContent,
      type: 'full',
      index: 0,
      start: 0,
      end: trimmedContent.length,
    }];
  }

  // 长内容按段落分块
  if (respectParagraphs) {
    return chunkByParagraph(trimmedContent, config);
  }

  // 按句子分块
  if (respectSentences) {
    return chunkBySentence(trimmedContent, config);
  }

  // 简单分块（带重叠）
  return chunkSimple(trimmedContent, config);
}

/**
 * 按段落分块
 */
function chunkByParagraph(content, config) {
  const { maxChunkSize, minChunkSize, overlapSize } = config;
  
  // 按双换行分割段落
  const paragraphs = content.split(/\n\n+/);
  const chunks = [];
  let current = '';
  let currentStart = 0;
  let position = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const paraWithSep = i > 0 ? '\n\n' + para : para;
    
    // 如果当前段落本身就超过最大长度，需要进一步拆分
    if (para.length > maxChunkSize) {
      // 先保存当前累积的内容
      if (current.trim().length >= minChunkSize) {
        chunks.push({
          text: current.trim(),
          type: 'paragraph',
          index: chunks.length,
          start: currentStart,
          end: position,
        });
        current = '';
      }
      
      // 按句子拆分超长段落
      const subChunks = chunkBySentence(para, config);
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          index: chunks.length,
          type: 'sentence',
        });
      }
      
      currentStart = position + paraWithSep.length;
      position += paraWithSep.length;
      continue;
    }

    // 检查是否需要创建新分块
    if (current.length + paraWithSep.length > maxChunkSize && current.trim().length >= minChunkSize) {
      chunks.push({
        text: current.trim(),
        type: 'paragraph',
        index: chunks.length,
        start: currentStart,
        end: position,
      });
      
      // 添加重叠内容
      if (overlapSize > 0 && current.length > overlapSize) {
        const overlapText = current.slice(-overlapSize);
        current = overlapText + paraWithSep;
      } else {
        current = paraWithSep;
      }
      
      currentStart = position - (current.length - paraWithSep.length);
    } else {
      current += paraWithSep;
    }
    
    position += paraWithSep.length;
  }

  // 处理剩余内容
  if (current.trim().length >= minChunkSize) {
    chunks.push({
      text: current.trim(),
      type: 'paragraph',
      index: chunks.length,
      start: currentStart,
      end: position,
    });
  } else if (chunks.length > 0 && current.trim().length > 0) {
    // 合并到最后一个分块
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.text += '\n\n' + current.trim();
    lastChunk.end = position;
  }

  return chunks;
}

/**
 * 按句子分块
 */
function chunkBySentence(content, config) {
  const { maxChunkSize, minChunkSize, overlapSize } = config;
  
  // 中文和英文句子分隔符
  const sentenceEndings = /(?<=[。！？!?.\n])\s*/g;
  const sentences = content.split(sentenceEndings).filter(s => s.trim());
  
  const chunks = [];
  let current = '';
  let currentStart = 0;
  let position = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) {
      position += sentence.length;
      continue;
    }

    // 如果单个句子就超过最大长度，强制分割
    if (trimmedSentence.length > maxChunkSize) {
      if (current.trim().length >= minChunkSize) {
        chunks.push({
          text: current.trim(),
          type: 'sentence',
          index: chunks.length,
          start: currentStart,
          end: position,
        });
        current = '';
      }
      
      // 强制分割超长句子
      const forcedChunks = chunkFixed(trimmedSentence, maxChunkSize, overlapSize);
      for (const fc of forcedChunks) {
        chunks.push({
          text: fc,
          type: 'overlap',
          index: chunks.length,
          start: position,
          end: position + fc.length,
        });
      }
      
      currentStart = position + trimmedSentence.length;
      position += trimmedSentence.length;
      continue;
    }

    // 检查是否需要创建新分块
    if (current.length + trimmedSentence.length + 1 > maxChunkSize && current.trim().length >= minChunkSize) {
      chunks.push({
        text: current.trim(),
        type: 'sentence',
        index: chunks.length,
        start: currentStart,
        end: position,
      });
      
      // 添加重叠
      if (overlapSize > 0 && current.length > overlapSize) {
        const overlapText = current.slice(-overlapSize);
        current = overlapText + trimmedSentence;
      } else {
        current = trimmedSentence;
      }
      
      currentStart = position - (current.length - trimmedSentence.length);
    } else {
      current = current ? current + ' ' + trimmedSentence : trimmedSentence;
    }
    
    position += sentence.length;
  }

  // 处理剩余内容
  if (current.trim().length >= minChunkSize) {
    chunks.push({
      text: current.trim(),
      type: 'sentence',
      index: chunks.length,
      start: currentStart,
      end: position,
    });
  } else if (chunks.length > 0 && current.trim().length > 0) {
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.text += ' ' + current.trim();
    lastChunk.end = position;
  }

  return chunks;
}

/**
 * 简单分块（固定大小 + 重叠）
 */
function chunkSimple(content, config) {
  const { maxChunkSize, overlapSize } = config;
  return chunkFixed(content, maxChunkSize, overlapSize);
}

/**
 * 固定大小分块
 */
function chunkFixed(content, chunkSize, overlap) {
  const chunks = [];
  let start = 0;

  while (start < content.length) {
    let end = start + chunkSize;
    
    // 尝试在句子边界处分割
    if (end < content.length) {
      const lastPeriod = content.lastIndexOf('。', end);
      const lastNewline = content.lastIndexOf('\n', end);
      const lastSpace = content.lastIndexOf(' ', end);
      
      const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(content.slice(start, end).trim());
    start = end - overlap;
    
    if (start >= content.length) break;
  }

  return chunks;
}

/**
 * 合并相邻的小分块
 */
function mergeSmallChunks(chunks, minSize) {
  const merged = [];
  let current = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
      continue;
    }

    if (current.text.length < minSize) {
      current.text += '\n\n' + chunk.text;
      current.end = chunk.end;
    } else {
      merged.push(current);
      current = { ...chunk };
    }
  }

  if (current) {
    merged.push(current);
  }

  // 重新编号
  return merged.map((chunk, index) => ({ ...chunk, index }));
}

/**
 * 获取分块统计信息
 */
function getChunkStats(chunks) {
  if (!chunks || chunks.length === 0) {
    return { count: 0, avgSize: 0, minSize: 0, maxSize: 0 };
  }

  const sizes = chunks.map(c => c.text.length);
  return {
    count: chunks.length,
    avgSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
    minSize: Math.min(...sizes),
    maxSize: Math.max(...sizes),
    types: chunks.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = {
  smartChunk,
  chunkByParagraph,
  chunkBySentence,
  chunkSimple,
  mergeSmallChunks,
  getChunkStats,
  DEFAULT_CONFIG,
};
