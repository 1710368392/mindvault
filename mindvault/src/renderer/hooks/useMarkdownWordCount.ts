import { useMemo } from 'react';

/**
 * 计算 Markdown 纯文本字数的 Hook
 * @param content Markdown 内容
 * @returns 单词数和字符数
 */
export function useMarkdownWordCount(content: string) {
  const counts = useMemo(() => {
    if (!content) {
      return { wordCount: 0, charCount: 0 };
    }

    // 移除 Markdown 标记
    let plainText = content
      // 移除代码块
      .replace(/```[\s\S]*?```/g, '')
      // 移除行内代码
      .replace(/`[^`]+`/g, '')
      // 移除标题标记
      .replace(/#{1,6}\s/g, '')
      // 移除引用标记
      .replace(/^>\s/gm, '')
      // 移除列表标记
      .replace(/^[*+-]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      // 移除链接
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 移除图片
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // 移除强调标记
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // 移除删除线
      .replace(/~~(.*?)~~/g, '$1')
      // 移除表格标记
      .replace(/\|/g, '')
      .replace(/-{3,}/g, '');

    // 计算字符数
    const charCount = plainText.length;

    // 计算单词数
    // 中文按字符计数，英文按空格分割
    const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g) || [];
    const englishWords = plainText
      .replace(/[\u4e00-\u9fa5]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    const wordCount = chineseChars.length + englishWords.length;

    return { wordCount, charCount };
  }, [content]);

  return counts;
}
