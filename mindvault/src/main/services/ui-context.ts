// @ts-nocheck
/**
 * UI 上下文服务
 * 维护当前应用界面的状态信息，供 AI 查询
 */

const { EventEmitter } = require('events');

class UIContextService extends EventEmitter {
  constructor() {
    super();
    this.context = {
      currentPage: 'home',
      selectedCreativityId: null,
      activeBoardId: null,
      focusedElement: null,
      visibleCreativities: [],
      userAction: '',
      timestamp: Date.now(),
    };
  }

  /**
   * 更新 UI 上下文（由渲染进程通过 IPC 调用）
   */
  updateContext(partialContext) {
    this.context = {
      ...this.context,
      ...partialContext,
      timestamp: Date.now(),
    };
    this.emit('context-updated', this.context);
  }

  /**
   * 获取当前 UI 上下文
   */
  getCurrentContext() {
    return { ...this.context };
  }

  /**
   * 格式化上下文为 AI 可读的文本
   */
  formatContextForAI() {
    const ctx = this.context;
    const parts = [];
    parts.push(`当前页面: ${ctx.currentPage}`);
    if (ctx.selectedCreativityId) {
      parts.push(`选中创意ID: ${ctx.selectedCreativityId}`);
    }
    if (ctx.activeBoardId) {
      parts.push(`当前看板ID: ${ctx.activeBoardId}`);
    }
    if (ctx.focusedElement) {
      parts.push(`焦点元素: ${ctx.focusedElement}`);
    }
    if (ctx.visibleCreativities.length > 0) {
      parts.push(`可见创意数量: ${ctx.visibleCreativities.length}`);
    }
    if (ctx.userAction) {
      parts.push(`最近操作: ${ctx.userAction}`);
    }
    parts.push(`上下文更新时间: ${new Date(ctx.timestamp).toLocaleString('zh-CN')}`);
    return parts.join('\n');
  }
}

const uiContextService = new UIContextService();
module.exports = { uiContextService };
