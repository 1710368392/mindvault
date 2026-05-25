/**
 * 验证工具函数
 */

/**
 * 验证邮箱
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 验证URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证非空字符串
 */
export function isNotEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 验证字符串长度
 */
export function isValidLength(
  value: string,
  min: number,
  max: number
): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * 验证密码强度
 */
export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { min: 0, label: '非常弱', color: '#EF4444' },
    { min: 2, label: '弱', color: '#F97316' },
    { min: 3, label: '一般', color: '#F59E0B' },
    { min: 4, label: '较强', color: '#10B981' },
    { min: 5, label: '强', color: '#059669' },
  ];

  const level = [...levels].reverse().find((l) => score >= l.min) || levels[0];
  return { score, ...level };
}

/**
 * 验证创意标题
 */
export function validateCreativityTitle(title: string): string | null {
  if (!isNotEmpty(title)) return '标题不能为空';
  if (!isValidLength(title, 1, 200)) return '标题长度应在1-200个字符之间';
  return null;
}

/**
 * 验证看板名称
 */
export function validateBoardName(name: string): string | null {
  if (!isNotEmpty(name)) return '看板名称不能为空';
  if (!isValidLength(name, 1, 50)) return '看板名称长度应在1-50个字符之间';
  return null;
}

/**
 * 验证标签名称
 */
export function validateTagName(name: string): string | null {
  if (!isNotEmpty(name)) return '标签名称不能为空';
  if (!isValidLength(name, 1, 20)) return '标签名称长度应在1-20个字符之间';
  if (/[<>]/.test(name)) return '标签名称不能包含特殊字符 < >';
  return null;
}

/**
 * 验证JSON字符串
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
