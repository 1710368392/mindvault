// @ts-nocheck
/**
 * 桌面自动化服务
 * 通过 Electron webContents 执行应用内 UI 操作
 */

/**
 * 在应用窗口中执行 JavaScript 代码
 * @param webContents - Electron webContents 实例
 * @param script - 要执行的 JS 代码
 */
async function executeInPage(webContents: any, script: string): Promise<any> {
  try {
    const result = await webContents.executeJavaScript(`
      (function() {
        try {
          ${script}
        } catch(e) {
          return { error: e.message };
        }
      })()
    `);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 点击页面元素
 */
async function clickElement(webContents: any, selector: string): Promise<any> {
  const script = `
    const el = document.querySelector('${selector}');
    if (el) {
      el.click();
      return { clicked: true, tagName: el.tagName, text: el.textContent?.substring(0, 50) };
    }
    return { clicked: false, error: 'Element not found' };
  `;
  return executeInPage(webContents, script);
}

/**
 * 在输入框中输入文字
 */
async function typeText(webContents: any, selector: string, text: string): Promise<any> {
  const script = `
    const el = document.querySelector('${selector}');
    if (el) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, '${text.replace(/'/g, "\\'")}');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.value = '${text.replace(/'/g, "\\'")}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return { typed: true, length: '${text}'.length };
    }
    return { typed: false, error: 'Element not found' };
  `;
  return executeInPage(webContents, script);
}

/**
 * 滚动到指定元素
 */
async function scrollToElement(webContents: any, selector: string): Promise<any> {
  const script = `
    const el = document.querySelector('${selector}');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { scrolled: true };
    }
    return { scrolled: false, error: 'Element not found' };
  `;
  return executeInPage(webContents, script);
}

/**
 * 获取页面 DOM 结构摘要（用于 AI 理解界面）
 */
async function getPageStructure(webContents: any): Promise<any> {
  const script = `
    function getStructure(el, depth) {
      if (depth > 3) return null;
      const children = [];
      for (const child of el.children) {
        const result = getStructure(child, depth + 1);
        if (result) children.push(result);
      }

      const tag = el.tagName?.toLowerCase();
      const role = el.getAttribute('role') || el.getAttribute('aria-label') || '';
      const text = el.textContent?.trim()?.substring(0, 30) || '';
      const clickable = el.onclick !== null ||
        tag === 'button' || tag === 'a' ||
        el.getAttribute('role') === 'button' ||
        el.classList?.contains('ant-btn') ||
        el.classList?.contains('ant-menu-item');

      if (children.length === 0 && !text && !clickable && !role) return null;

      return {
        tag,
        role,
        text: text || undefined,
        clickable: clickable || undefined,
        children: children.length > 0 ? children : undefined,
      };
    }

    return JSON.stringify(getStructure(document.body, 0));
  `;
  return executeInPage(webContents, script);
}

/**
 * 获取可交互元素列表
 */
async function getInteractiveElements(webContents: any): Promise<any> {
  const script = `
    const elements = [];
    const selectors = 'button, a, input, textarea, select, [role="button"], [role="link"], [role="menuitem"], [onclick], .ant-btn, .ant-menu-item, .ant-input';

    document.querySelectorAll(selectors).forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        elements.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          type: el.type || el.getAttribute('role') || '',
          text: (el.textContent || el.value || el.placeholder || '').trim().substring(0, 50),
          ariaLabel: el.getAttribute('aria-label') || '',
          className: el.className?.toString()?.substring(0, 100) || '',
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    });

    return JSON.stringify(elements.slice(0, 100));
  `;
  return executeInPage(webContents, script);
}

module.exports = {
  executeInPage,
  clickElement,
  typeText,
  scrollToElement,
  getPageStructure,
  getInteractiveElements,
};
