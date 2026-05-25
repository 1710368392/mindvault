// @ts-nocheck
/**
 * 工具执行引擎
 * 定义和执行 AI 可调用的工具（OpenAI function calling 格式）
 */

const repo = require('../db/repository');
const musicLibrary = require('../services/music-library');
const musicOnline = require('../services/music-online');
const { webSearch } = require('../services/ai-service');
const skillService = require('./skill-service');
const haooneService = require('./haoone-service');
const codeExecutor = require('./code-executor');
const fileOps = require('./file-operations');
const { BrowserWindow } = require('electron');

let currentAIConfig = null;

function setAIConfig(config) {
  currentAIConfig = config;
}

function generateId() {
  const crypto = require('crypto');
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function notifyCreativityChange() {
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('creativity:changed');
      }
    }
  } catch (e) {
    // ignore
  }
}

// ============================================================
// 工具定义（OpenAI function calling 格式）
// ============================================================

const TOOL_DEFINITIONS = [
  // ---- 原有 10 个工具 ----
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前的日期和时间信息，包括年月日、星期、时分秒',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_creativity',
      description: '搜索用户的创意库，根据关键词查找相关的创意内容（如笔记、灵感、想法等）',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词',
          },
          limit: {
            type: 'number',
            description: '返回结果数量上限，默认为10',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_creativity',
      description: '在用户的创意库中创建一条新的创意记录（如笔记、灵感、想法等）',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '创意标题',
          },
          content: {
            type: 'string',
            description: '创意内容',
          },
          type: {
            type: 'string',
            description: '创意类型，如 text（文本）、image（图片）、audio（音频）等，默认为 text',
            enum: ['text', 'image', 'video', 'audio', 'document'],
          },
          subtype: {
            type: 'string',
            description: '创意子类型，如 idea（灵感）、note（笔记）、draft（草稿）等',
          },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_music_status',
      description: '获取当前音乐播放状态，包括正在播放的歌曲信息和播放状态',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'control_music',
      description: '控制音乐播放，包括停止、暂停、继续播放。当用户要求关闭音乐、停止播放、暂停音乐时使用此工具。',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: '控制动作',
            enum: ['stop', 'pause', 'resume'],
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_music',
      description: '搜索音乐，支持搜索本地音乐库和在线音乐',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词（歌曲名、歌手名等）',
          },
          source: {
            type: 'string',
            description: '搜索来源：local（本地）、online（在线）、all（全部），默认为 all',
            enum: ['local', 'online', 'all'],
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: '数学计算器，计算数学表达式的结果。支持基本运算（加减乘除）、幂运算、括号等',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，例如 "(2 + 3) * 4"、"sqrt(16)"、"2 ^ 10"',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '联网搜索，通过搜索引擎查找互联网上的信息',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索查询内容',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description: '执行代码片段并返回结果。支持 JavaScript 和 Python。',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '要执行的代码',
          },
          language: {
            type: 'string',
            description: '编程语言：javascript 或 python，默认为 javascript',
            enum: ['javascript', 'python'],
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取指定路径的文件内容。仅支持文本文件，最大10MB。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件的完整路径',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: '列出指定目录下的文件和文件夹',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '目录的完整路径',
          },
        },
        required: ['path'],
      },
    },
  },

  // ---- 新增工具：创意管理 ----
  {
    type: 'function',
    function: {
      name: 'update_creativity',
      description: '更新已有创意的标题、内容、类型或子类型',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '创意 ID',
          },
          title: {
            type: 'string',
            description: '新的创意标题',
          },
          content: {
            type: 'string',
            description: '新的创意内容',
          },
          type: {
            type: 'string',
            description: '新的创意类型',
            enum: ['text', 'image', 'video', 'audio', 'document'],
          },
          subtype: {
            type: 'string',
            description: '新的创意子类型',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_creativity',
      description: '软删除一条创意（将状态设为 trashed），不会真正从数据库中移除',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '要删除的创意 ID',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_creativity_detail',
      description: '根据 ID 获取一条创意的完整详情',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '创意 ID',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_creativities',
      description: '分页列出创意，支持按类型、状态筛选和排序',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            description: '页码，从 1 开始，默认为 1',
          },
          pageSize: {
            type: 'number',
            description: '每页数量，默认为 20',
          },
          type: {
            type: 'string',
            description: '按类型筛选：text、image、video、audio、document',
          },
          status: {
            type: 'string',
            description: '按状态筛选：active、trashed、archived',
          },
          sortBy: {
            type: 'string',
            description: '排序字段，默认为 updated_at',
            enum: ['created_at', 'updated_at', 'title'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tag_creativity',
      description: '为创意添加标签。如果标签不存在会自动创建',
      parameters: {
        type: 'object',
        properties: {
          creativityId: {
            type: 'string',
            description: '创意 ID',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签名称数组',
          },
        },
        required: ['creativityId', 'tags'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'link_creativities',
      description: '在两条创意之间建立关联关系',
      parameters: {
        type: 'object',
        properties: {
          sourceId: {
            type: 'string',
            description: '源创意 ID',
          },
          targetId: {
            type: 'string',
            description: '目标创意 ID',
          },
          relationType: {
            type: 'string',
            description: '关联类型',
            enum: ['related', 'derived', 'combined'],
          },
        },
        required: ['sourceId', 'targetId'],
      },
    },
  },

  // ---- 新增工具：画板管理 ----
  {
    type: 'function',
    function: {
      name: 'create_board',
      description: '创建一个新的画板（Board）',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '画板名称',
          },
          description: {
            type: 'string',
            description: '画板描述',
          },
          layout: {
            type: 'string',
            description: '画板布局类型，如 free、grid、timeline',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_board',
      description: '将一条创意添加到指定画板中',
      parameters: {
        type: 'object',
        properties: {
          boardId: {
            type: 'string',
            description: '画板 ID',
          },
          creativityId: {
            type: 'string',
            description: '创意 ID',
          },
        },
        required: ['boardId', 'creativityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_board_overview',
      description: '获取画板概览信息，包括画板名称、描述和包含的创意数量',
      parameters: {
        type: 'object',
        properties: {
          boardId: {
            type: 'string',
            description: '画板 ID',
          },
        },
        required: ['boardId'],
      },
    },
  },

  // ---- 新增工具：标签管理 ----
  {
    type: 'function',
    function: {
      name: 'create_tag',
      description: '创建一个新标签',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '标签名称',
          },
          color: {
            type: 'string',
            description: '标签颜色（十六进制色值，如 #FF5733）',
          },
          icon: {
            type: 'string',
            description: '标签图标名称',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tags',
      description: '根据关键词搜索标签',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_popular_tags',
      description: '获取使用最多的标签（热门标签）',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '返回数量上限，默认为 10',
          },
        },
        required: [],
      },
    },
  },

  // ---- 新增工具：搜索 ----
  {
    type: 'function',
    function: {
      name: 'search_templates',
      description: '根据关键词搜索创意模板',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'global_search',
      description: '全局搜索，在所有内容（创意、画板、标签等）中进行搜索',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词',
          },
          limit: {
            type: 'number',
            description: '返回结果数量上限，默认为 20',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_by_date_range',
      description: '按日期范围搜索创意',
      parameters: {
        type: 'object',
        properties: {
          dateFrom: {
            type: 'string',
            description: '起始日期（ISO 格式，如 2025-01-01）',
          },
          dateTo: {
            type: 'string',
            description: '结束日期（ISO 格式，如 2025-12-31）',
          },
          limit: {
            type: 'number',
            description: '返回结果数量上限，默认为 20',
          },
        },
        required: [],
      },
    },
  },

  // ---- 新增工具：统计与历史 ----
  {
    type: 'function',
    function: {
      name: 'get_app_stats',
      description: '获取应用统计数据，包括创意总数、画板总数、标签总数等',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_edits',
      description: '获取最近编辑的创意列表',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '返回数量上限，默认为 10',
          },
        },
        required: [],
      },
    },
  },

  // ---- 新增工具：UI 交互 ----
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: '请求导航到指定页面',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description: '目标页面名称',
            enum: ['home', 'board', 'search', 'favorites', 'trash', 'templates', 'stats', 'settings'],
          },
          params: {
            type: 'object',
            description: '页面参数（可选，如 { boardId: "xxx" }）',
          },
        },
        required: ['page'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_context',
      description: '获取当前 UI 上下文信息（当前页面、选中内容等）',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_notification',
      description: '显示桌面通知',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '通知标题',
          },
          body: {
            type: 'string',
            description: '通知内容',
          },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_external_url',
      description: '在默认浏览器中打开 URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '要打开的 URL 地址',
          },
        },
        required: ['url'],
      },
    },
  },

  // ---- 设置管理 ----
  {
    type: 'function',
    function: {
      name: 'update_settings',
      description: '更新软件设置，如音效、主题、AI 配置等',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: '设置项的键名，如 ttsVoice、soundEnabled、theme 等',
          },
          value: {
            type: 'any',
            description: '设置项的新值',
          },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_tts_voice',
      description: '更换 AI 朗读音色。当用户要求更换音色时调用，如"换成御姐音"、"换个男声"等',
      parameters: {
        type: 'object',
        properties: {
          voiceType: {
            type: 'string',
            description: '音色类型描述，如"御姐"、"萝莉"、"男声"、"女声"、"成熟"、"温柔"等',
            enum: ['御姐', '萝莉', '温柔女声', '成熟女声', '男声', '成熟男声', '温柔男声', '默认'],
          },
        },
        required: ['voiceType'],
      },
    },
  },

  // ---- 写作台 ----
  {
    type: 'function',
    function: {
      name: 'create_writing_chapter',
      description: '在写作台创建一个新章节。当用户要求写小说章节、创作故事、生成文章内容时使用此工具。章节会被保存到写作台中。',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '章节标题',
          },
          content: {
            type: 'string',
            description: '章节正文内容',
          },
          chapterNumber: {
            type: 'number',
            description: '章节序号（如第1章、第2章），可选',
          },
          wordCount: {
            type: 'number',
            description: '字数要求，可选',
          },
        },
        required: ['title', 'content'],
      },
    },
  },

  // ---- P0 - 创意管理补齐 ----
  // toggle_favorite - 收藏/取消收藏创意
  {
    type: 'function',
    function: {
      name: 'toggle_favorite',
      description: '收藏或取消收藏一个创意',
      parameters: { type: 'object', properties: { creativityId: { type: 'string', description: '创意ID' } }, required: ['creativityId'] },
    },
  },
  // restore_creativity - 恢复已删除创意
  {
    type: 'function',
    function: {
      name: 'restore_creativity',
      description: '从回收站恢复已删除的创意',
      parameters: { type: 'object', properties: { creativityId: { type: 'string', description: '创意ID' } }, required: ['creativityId'] },
    },
  },
  // permanent_delete_creativity - 永久删除创意
  {
    type: 'function',
    function: {
      name: 'permanent_delete_creativity',
      description: '永久删除创意（不可恢复）',
      parameters: { type: 'object', properties: { creativityId: { type: 'string', description: '创意ID' } }, required: ['creativityId'] },
    },
  },
  // batch_delete_creativities - 批量删除创意
  {
    type: 'function',
    function: {
      name: 'batch_delete_creativities',
      description: '批量删除多个创意',
      parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: '创意ID列表' } }, required: ['ids'] },
    },
  },
  // get_random_creativity - 随机获取创意
  {
    type: 'function',
    function: {
      name: 'get_random_creativity',
      description: '随机获取一条创意，用于获取灵感',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // get_creativity_stats - 获取创意统计
  {
    type: 'function',
    function: {
      name: 'get_creativity_stats',
      description: '获取创意库的详细统计信息，包括总数、各类型分布等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },

  // ---- P1 - 看板操作补齐 ----
  // list_boards - 列出所有看板
  {
    type: 'function',
    function: {
      name: 'list_boards',
      description: '列出用户的所有看板',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // update_board - 更新看板
  {
    type: 'function',
    function: {
      name: 'update_board',
      description: '更新看板信息（名称、描述等）',
      parameters: { type: 'object', properties: { boardId: { type: 'string' }, data: { type: 'object', description: '要更新的字段' } }, required: ['boardId', 'data'] },
    },
  },
  // delete_board - 删除看板
  {
    type: 'function',
    function: {
      name: 'delete_board',
      description: '删除一个看板',
      parameters: { type: 'object', properties: { boardId: { type: 'string' } }, required: ['boardId'] },
    },
  },
  // remove_from_board - 从看板移除创意
  {
    type: 'function',
    function: {
      name: 'remove_from_board',
      description: '将创意从看板中移除',
      parameters: { type: 'object', properties: { boardId: { type: 'string' }, creativityId: { type: 'string' } }, required: ['boardId', 'creativityId'] },
    },
  },
  // list_board_creativities - 列出看板中的创意
  {
    type: 'function',
    function: {
      name: 'list_board_creativities',
      description: '列出指定看板中的所有创意',
      parameters: { type: 'object', properties: { boardId: { type: 'string' } }, required: ['boardId'] },
    },
  },
  // create_sticky_note - 创建便签
  {
    type: 'function',
    function: {
      name: 'create_sticky_note',
      description: '在看板上创建便签',
      parameters: { type: 'object', properties: { boardId: { type: 'string' }, content: { type: 'string' }, color: { type: 'string', description: '便签颜色' }, positionX: { type: 'number' }, positionY: { type: 'number' } }, required: ['boardId', 'content'] },
    },
  },
  // delete_sticky_note - 删除便签
  {
    type: 'function',
    function: {
      name: 'delete_sticky_note',
      description: '删除看板上的便签',
      parameters: { type: 'object', properties: { boardId: { type: 'string' }, noteId: { type: 'string' } }, required: ['boardId', 'noteId'] },
    },
  },
  // create_board_folder - 创建看板文件夹
  {
    type: 'function',
    function: {
      name: 'create_board_folder',
      description: '在看板中创建文件夹来组织创意',
      parameters: { type: 'object', properties: { boardId: { type: 'string' }, name: { type: 'string' } }, required: ['boardId', 'name'] },
    },
  },
  // add_to_folder - 将创意添加到文件夹
  {
    type: 'function',
    function: {
      name: 'add_to_folder',
      description: '将创意添加到看板文件夹中',
      parameters: { type: 'object', properties: { boardId: { type: 'string' }, folderId: { type: 'string' }, creativityId: { type: 'string' } }, required: ['boardId', 'folderId', 'creativityId'] },
    },
  },

  // ---- P2 - 标签/模板补齐 ----
  // delete_tag - 删除标签
  {
    type: 'function',
    function: {
      name: 'delete_tag',
      description: '删除一个标签',
      parameters: { type: 'object', properties: { tagId: { type: 'string' } }, required: ['tagId'] },
    },
  },
  // update_tag - 更新标签
  {
    type: 'function',
    function: {
      name: 'update_tag',
      description: '更新标签信息（名称、颜色等）',
      parameters: { type: 'object', properties: { tagId: { type: 'string' }, data: { type: 'object', description: '要更新的字段' } }, required: ['tagId', 'data'] },
    },
  },
  // list_tags - 列出所有标签
  {
    type: 'function',
    function: {
      name: 'list_tags',
      description: '列出所有标签',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // apply_template - 应用模板到创意
  {
    type: 'function',
    function: {
      name: 'apply_template',
      description: '将模板应用到指定创意',
      parameters: { type: 'object', properties: { templateId: { type: 'string' }, creativityId: { type: 'string' } }, required: ['templateId', 'creativityId'] },
    },
  },

  // ---- 天气系统工具 ----
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取当前天气信息，包括温度、天气状况、城市等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather_forecast',
      description: '获取未来几天的天气预报，包括温度范围、降水概率等',
      parameters: { type: 'object', properties: { days: { type: 'number', description: '预报天数，默认为3天', default: 3 } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather_alerts',
      description: '获取天气预警信息，如暴雨、雷电、高温等异常天气提醒',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_weather_alerts',
      description: '开启或关闭天气预警功能',
      parameters: { type: 'object', properties: { enabled: { type: 'boolean', description: '是否开启预警' } }, required: ['enabled'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_weather_briefing_time',
      description: '设置早晚天气播报的时间',
      parameters: { type: 'object', properties: { type: { type: 'string', enum: ['morning', 'evening'], description: '播报类型：morning(早上)或evening(晚上)' }, time: { type: 'string', description: '时间，格式为 HH:MM，如 08:00' } }, required: ['type', 'time'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_daily_weather_briefing',
      description: '显示今日天气播报，包括当前天气、穿衣建议、出行建议等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_weather_location_mode',
      description: '切换天气定位模式：自动定位或手动选择城市。当用户说"切换为自动定位"、"使用自动定位"、"改为手动选择"等时使用此工具。',
      parameters: { 
        type: 'object', 
        properties: { 
          mode: { 
            type: 'string', 
            enum: ['auto', 'manual'], 
            description: '定位模式：auto(自动定位)或manual(手动选择城市)' 
          } 
        }, 
        required: ['mode'] 
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_city_selector',
      description: '打开城市选择器，让用户手动选择城市。当用户说"切换城市"、"选择城市"、"打开城市选择"等时使用此工具。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_weather_location',
      description: '获取当前天气定位信息，包括当前使用的城市、定位模式（自动/手动）等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_forecast_notification',
      description: '即时触发一次明日天气预报通知弹窗，让用户看到明天的天气情况。当用户说"看看明天天气"、"弹出天气预报通知"时使用',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_alert_notification',
      description: '即时触发一次天气预警检查并弹出预警通知。当用户说"检查天气预警"、"有没有天气异常"时使用',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },

  // ---- P3 - 导出/备份/回收站/音乐精细控制 ----
  // export_creativities - 导出创意
  {
    type: 'function',
    function: {
      name: 'export_creativities',
      description: '导出创意为指定格式（json/html/markdown）',
      parameters: { type: 'object', properties: { format: { type: 'string', enum: ['json', 'html', 'markdown'], description: '导出格式' }, ids: { type: 'array', items: { type: 'string' }, description: '要导出的创意ID列表，不传则导出全部' } }, required: ['format'] },
    },
  },
  // list_trash - 列出回收站
  {
    type: 'function',
    function: {
      name: 'list_trash',
      description: '列出回收站中的已删除创意',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // clear_trash - 清空回收站
  {
    type: 'function',
    function: {
      name: 'clear_trash',
      description: '清空回收站，永久删除所有已删除的创意',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // control_music_advanced - 高级音乐控制
  {
    type: 'function',
    function: {
      name: 'control_music_advanced',
      description: '高级音乐控制：切歌、调节音量、切换播放模式等',
      parameters: { type: 'object', properties: { action: { type: 'string', enum: ['next_track', 'prev_track', 'volume_up', 'volume_down', 'set_volume', 'toggle_play_mode', 'toggle_favorite'], description: '控制动作' }, value: { type: 'number', description: '参数值（如音量百分比）' } }, required: ['action'] },
    },
  },

  // ============================================================
  // 对标 Trae SOLO 五大工具能力
  // ============================================================

  // ---- 1. 阅读：对创意进行检索和查看 ----
  {
    type: 'function',
    function: {
      name: 'read_creativities',
      description: '批量阅读多条创意的完整内容。当需要同时查看多条创意、对比多条创意内容、或阅读某个主题下的所有创意时使用。返回每条创意的标题、内容、类型、标签和创建时间。',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: '要阅读的创意ID列表',
          },
          query: {
            type: 'string',
            description: '按关键词搜索并阅读匹配的创意（与ids二选一）',
          },
          limit: {
            type: 'number',
            description: '使用query时返回的最大数量，默认为10',
          },
          includeContent: {
            type: 'boolean',
            description: '是否包含完整内容（默认true），设为false则只返回摘要',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_creativity_full',
      description: '深度阅读一条创意的完整详情，包括内容、标签、关联创意、所属画板、编辑历史等全部信息。当用户要求"详细看看这条创意"、"展开看看"时使用。',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '创意ID',
          },
          includeRelated: {
            type: 'boolean',
            description: '是否包含关联创意信息，默认为true',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_creativity_library',
      description: '扫描创意库概览：获取创意总数、各类型分布、最近活跃创意、热门标签等全局信息。当用户要求"看看我的创意库"、"概览一下"时使用。',
      parameters: {
        type: 'object',
        properties: {
          includeRecent: {
            type: 'boolean',
            description: '是否包含最近编辑的创意列表，默认为true',
          },
          includeTagCloud: {
            type: 'boolean',
            description: '是否包含标签云，默认为true',
          },
          recentLimit: {
            type: 'number',
            description: '最近创意返回数量，默认为5',
          },
        },
        required: [],
      },
    },
  },

  // ---- 2. 编辑：对创意进行增删和编辑 ----
  {
    type: 'function',
    function: {
      name: 'batch_create_creativities',
      description: '批量创建多条创意。当需要一次创建多个相关创意、批量导入灵感列表时使用。每条创意可独立设置标题和内容。',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '创意标题' },
                content: { type: 'string', description: '创意内容' },
                type: { type: 'string', description: '创意类型', enum: ['text', 'image', 'video', 'audio', 'document'] },
                subtype: { type: 'string', description: '子类型' },
                tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
              },
              required: ['title', 'content'],
            },
            description: '要批量创建的创意列表',
          },
          boardId: {
            type: 'string',
            description: '创建后自动添加到指定画板（可选）',
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'smart_edit_creativity',
      description: '智能编辑创意：对已有创意进行追加、替换、改写等操作。支持多种编辑模式：append（追加内容）、prepend（前置内容）、replace（替换全部内容）、rewrite（AI改写润色）、merge（合并多条创意）。',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '要编辑的创意ID',
          },
          mode: {
            type: 'string',
            enum: ['append', 'prepend', 'replace', 'rewrite', 'merge'],
            description: '编辑模式：append追加、prepend前置、replace替换、rewrite改写润色、merge合并',
          },
          content: {
            type: 'string',
            description: '编辑内容（append/prepend/replace模式必填）',
          },
          mergeIds: {
            type: 'array',
            items: { type: 'string' },
            description: '要合并的创意ID列表（merge模式必填）',
          },
          rewriteStyle: {
            type: 'string',
            description: '改写风格（rewrite模式可选）：formal正式、casual轻松、creative创意、concise精简、expand扩展',
          },
        },
        required: ['id', 'mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'organize_creativities',
      description: '整理创意：批量移动创意到画板、批量添加/移除标签、批量修改类型等。当用户要求"整理一下这些创意"、"把这些归到一起"时使用。',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['move_to_board', 'add_tags', 'remove_tags', 'change_type', 'change_subtype'],
            description: '整理操作类型',
          },
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: '要整理的创意ID列表',
          },
          boardId: {
            type: 'string',
            description: '目标画板ID（move_to_board操作必填）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（add_tags/remove_tags操作必填）',
          },
          newType: {
            type: 'string',
            description: '新类型（change_type操作必填）',
          },
          newSubtype: {
            type: 'string',
            description: '新子类型（change_subtype操作必填）',
          },
        },
        required: ['action', 'ids'],
      },
    },
  },

  // ---- 3. 终端：执行代码和脚本 ----
  {
    type: 'function',
    function: {
      name: 'run_script',
      description: '执行脚本文件或命令行指令。支持运行Python脚本、Shell命令、Node.js脚本等。当用户要求"运行这个脚本"、"执行这个命令"时使用。',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令或脚本路径',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: '命令参数列表',
          },
          cwd: {
            type: 'string',
            description: '工作目录（可选）',
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒），默认30000',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'data_transform',
      description: '数据转换工具：对创意内容进行格式转换、数据提取、文本处理等。支持JSON/CSV/Markdown互转、文本提取、正则匹配等。',
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: '输入数据或创意ID',
          },
          operation: {
            type: 'string',
            enum: ['json_to_csv', 'csv_to_json', 'markdown_to_json', 'json_to_markdown', 'extract_links', 'extract_keywords', 'regex_match', 'text_stats'],
            description: '转换操作类型',
          },
          options: {
            type: 'object',
            description: '操作选项（如正则表达式、分隔符等）',
          },
        },
        required: ['input', 'operation'],
      },
    },
  },

  // ---- 4. 预览：预览创意内容 ----
  {
    type: 'function',
    function: {
      name: 'preview_creativity',
      description: '预览创意内容：在应用中打开创意的预览视图，支持Markdown渲染、代码高亮等。当用户要求"预览一下"、"看看效果"时使用。',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '要预览的创意ID',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'plain', 'html'],
            description: '预览格式，默认为markdown',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'preview_markdown',
      description: '将Markdown文本渲染为预览效果并展示给用户。当AI生成了Markdown格式的内容（如报告、文章、文档）需要用户查看效果时使用。',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Markdown格式的文本内容',
          },
          title: {
            type: 'string',
            description: '预览窗口标题',
          },
          saveAsCreativity: {
            type: 'boolean',
            description: '是否同时保存为创意，默认为false',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_and_preview',
      description: '生成内容并预览：AI根据需求生成创意内容，同时打开预览窗口展示效果。当用户要求"写一篇文章并预览"、"生成报告看看效果"时使用。',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: '生成内容的提示词/需求描述',
          },
          format: {
            type: 'string',
            enum: ['article', 'report', 'story', 'poem', 'outline', 'summary'],
            description: '内容格式：article文章、report报告、story故事、poem诗歌、outline大纲、summary摘要',
          },
          saveAsCreativity: {
            type: 'boolean',
            description: '是否保存为创意，默认为true',
          },
        },
        required: ['prompt'],
      },
    },
  },

  // ---- 5. 联网搜索：搜索和用户任务相关的网页内容 ----
  {
    type: 'function',
    function: {
      name: 'search_and_save',
      description: '联网搜索并保存：搜索互联网信息，将搜索结果整理后保存为创意。当用户要求"搜索一下XX并保存"、"查一下XX的资料"时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索查询内容',
          },
          saveToBoard: {
            type: 'string',
            description: '保存到指定画板ID（可选）',
          },
          maxResults: {
            type: 'number',
            description: '最大搜索结果数，默认为5',
          },
          autoSummarize: {
            type: 'boolean',
            description: '是否自动总结搜索结果，默认为true',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deep_research',
      description: '深度研究：对某个主题进行多轮联网搜索，综合多个来源的信息，生成结构化的研究报告。当用户要求"深入研究XX"、"全面了解XX"时使用。',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: '研究主题',
          },
          depth: {
            type: 'number',
            description: '搜索深度（轮次），1-5，默认为3',
          },
          saveAsCreativity: {
            type: 'boolean',
            description: '是否保存研究报告为创意，默认为true',
          },
          aspects: {
            type: 'array',
            items: { type: 'string' },
            description: '需要研究的方面/角度（可选）',
          },
        },
        required: ['topic'],
      },
    },
  },
  // ---- haoone 音视频转录 ----
  {
    type: 'function',
    function: {
      name: 'check_haoone_environment',
      description: '检查 haoone-cli 环境和登录状态。在使用 haoone 转录功能前应先调用此工具确认环境就绪。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_transcribe',
      description: '使用 haoone-cli 转录单个音视频文件，生成字幕。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '音视频文件路径' },
          outputDir: { type: 'string', description: '输出目录（可选），不指定则保存到输入文件同级的 transcriptions 目录' },
          model: { type: 'string', description: '模型名称（可选），如"中英-v2-2026"' },
          language: { type: 'string', description: '语言代码（可选），默认"zh"' },
          timelineName: { type: 'string', description: '时间线名称（可选）' },
          enableAiCorrection: { type: 'boolean', description: '是否启用AI智能拆行（可选），默认false' },
          maxSubtitleLength: { type: 'integer', description: '单行字幕最大字符数（可选），默认25' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_batch_transcribe',
      description: '批量转录多个音视频文件。',
      parameters: {
        type: 'object',
        properties: {
          filePaths: { type: 'array', items: { type: 'string' }, description: '文件路径数组' },
          outputDir: { type: 'string', description: '输出目录（可选）' },
          model: { type: 'string', description: '模型名称（可选）' },
          language: { type: 'string', description: '语言代码（可选），默认"zh"' },
          enableAiCorrection: { type: 'boolean', description: '是否启用AI智能拆行（可选），默认true' },
        },
        required: ['filePaths'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_list_models',
      description: '列出 haoone 已安装的所有本地转录模型。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_get_config',
      description: '读取 haoone 软件的关键配置信息。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_create_project',
      description: '创建 haoone 项目。',
      parameters: {
        type: 'object',
        properties: { projectName: { type: 'string', description: '项目名称' } },
        required: ['projectName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_delete_project',
      description: '删除 haoone 项目。',
      parameters: {
        type: 'object',
        properties: { projectName: { type: 'string', description: '项目名称（可选），不传则删除当前项目' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_format_draft',
      description: '对文稿进行格式化整理。',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: '文稿文件路径' } },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_get_project_list',
      description: '获取 haoone 所有项目的列表。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'haoone_get_hotwords',
      description: '获取 haoone 当前的热词配置。',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// 技能系统工具定义（动态添加，避免修改 TOOL_DEFINITIONS 的结构）
const SKILL_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_skill_prompt',
      description: '获取指定技能的完整操作指南。当系统提示有可用技能且你需要参考该技能的详细指引时调用。',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: '技能ID（从可用技能提示中获取）',
          },
        },
        required: ['skill_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_available_skills',
      description: '列出所有可用的技能及其描述，用于查看有哪些技能可以使用。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: '按分类筛选（可选），如"文档处理"、"前端开发"等',
          },
        },
      },
    },
  },
];

// ============================================================
// 工具执行逻辑
// ============================================================

/**
 * 获取所有可用工具的定义
 * @returns {Array} OpenAI function calling 格式的工具定义数组
 */
function getToolDefinitions() {
  return [...TOOL_DEFINITIONS, ...SKILL_TOOL_DEFINITIONS];
}

/**
 * 执行指定工具
 * @param {string} name - 工具名称
 * @param {object} args - 工具参数
 * @returns {Promise<string>} 工具执行结果（文本格式）
 */
async function executeTool(name, args) {
  switch (name) {
    // ---- 原有工具 ----
    case 'get_current_time':
      return handleGetCurrentTime();
    case 'search_creativity':
      return handleSearchCreativity(args);
    case 'create_creativity':
      return handleCreateCreativity(args);
    case 'get_music_status':
      return handleGetMusicStatus();
    case 'control_music':
      return handleControlMusic(args);
    case 'search_music':
      return handleSearchMusic(args);
    case 'calculate':
      return handleCalculate(args);
    case 'web_search':
      return handleWebSearch(args);
    case 'execute_code':
      return handleExecuteCode(args);
    case 'read_file':
      return handleReadFile(args);
    case 'list_directory':
      return handleListDirectory(args);

    // ---- 创意管理 ----
    case 'update_creativity':
      return handleUpdateCreativity(args);
    case 'delete_creativity':
      return handleDeleteCreativity(args);
    case 'get_creativity_detail':
      return handleGetCreativityDetail(args);
    case 'list_creativities':
      return handleListCreativities(args);
    case 'tag_creativity':
      return handleTagCreativity(args);
    case 'link_creativities':
      return handleLinkCreativities(args);

    // ---- 画板管理 ----
    case 'create_board':
      return handleCreateBoard(args);
    case 'add_to_board':
      return handleAddToBoard(args);
    case 'get_board_overview':
      return handleGetBoardOverview(args);

    // ---- 标签管理 ----
    case 'create_tag':
      return handleCreateTag(args);
    case 'search_tags':
      return handleSearchTags(args);
    case 'get_popular_tags':
      return handleGetPopularTags(args);

    // ---- 搜索 ----
    case 'search_templates':
      return handleSearchTemplates(args);
    case 'global_search':
      return handleGlobalSearch(args);
    case 'search_by_date_range':
      return handleSearchByDateRange(args);

    // ---- 统计与历史 ----
    case 'get_app_stats':
      return handleGetAppStats();
    case 'get_recent_edits':
      return handleGetRecentEdits(args);

    // ---- UI 交互 ----
    case 'navigate_to_page':
      return handleNavigateToPage(args);
    case 'get_current_context':
      return handleGetCurrentContext();
    case 'show_notification':
      return handleShowNotification(args);

    // ---- 写作台 ----
    case 'create_writing_chapter':
      return handleCreateWritingChapter(args);
    case 'open_external_url':
      return handleOpenExternalUrl(args);

    // ---- 设置管理 ----
    case 'update_settings':
      return handleUpdateSettings(args);
    case 'change_tts_voice':
      return handleChangeTTSVoice(args);

    // ---- P0 - 创意管理补齐 ----
    case 'toggle_favorite':
      return handleToggleFavorite(args);
    case 'restore_creativity':
      return handleRestoreCreativity(args);
    case 'permanent_delete_creativity':
      return handlePermanentDeleteCreativity(args);
    case 'batch_delete_creativities':
      return handleBatchDeleteCreativities(args);
    case 'get_random_creativity':
      return handleGetRandomCreativity();
    case 'get_creativity_stats':
      return handleGetCreativityStats();

    // ---- P1 - 看板操作补齐 ----
    case 'list_boards':
      return handleListBoards();
    case 'update_board':
      return handleUpdateBoard(args);
    case 'delete_board':
      return handleDeleteBoard(args);
    case 'remove_from_board':
      return handleRemoveFromBoard(args);
    case 'list_board_creativities':
      return handleListBoardCreativities(args);
    case 'create_sticky_note':
      return handleCreateStickyNote(args);
    case 'delete_sticky_note':
      return handleDeleteStickyNote(args);
    case 'create_board_folder':
      return handleCreateBoardFolder(args);
    case 'add_to_folder':
      return handleAddToFolder(args);

    // ---- P2 - 标签/模板补齐 ----
    case 'delete_tag':
      return handleDeleteTag(args);
    case 'update_tag':
      return handleUpdateTag(args);
    case 'list_tags':
      return handleListTags();
    case 'apply_template':
      return handleApplyTemplate(args);

    // ---- 天气系统工具 ----
    case 'get_weather':
      return handleGetWeather();
    case 'get_weather_forecast':
      return handleGetWeatherForecast(args);
    case 'get_weather_alerts':
      return handleGetWeatherAlerts();
    case 'toggle_weather_alerts':
      return handleToggleWeatherAlerts(args);
    case 'set_weather_briefing_time':
      return handleSetWeatherBriefingTime(args);
    case 'show_daily_weather_briefing':
      return handleShowDailyWeatherBriefing();
    case 'set_weather_location_mode':
      return handleSetWeatherLocationMode(args);
    case 'open_city_selector':
      return handleOpenCitySelector();
    case 'get_current_weather_location':
      return handleGetCurrentWeatherLocation();
    case 'trigger_forecast_notification':
      return handleTriggerForecastNotification();
    case 'trigger_alert_notification':
      return handleTriggerAlertNotification();

    // ---- P3 - 导出/备份/回收站/音乐精细控制 ----
    case 'export_creativities':
      return handleExportCreativities(args);
    case 'list_trash':
      return handleListTrash();
    case 'clear_trash':
      return handleClearTrash();
    case 'control_music_advanced':
      return handleControlMusicAdvanced(args);

    // ---- 对标 Trae SOLO 五大工具能力 ----
    case 'read_creativities':
      return handleReadCreativities(args);
    case 'read_creativity_full':
      return handleReadCreativityFull(args);
    case 'scan_creativity_library':
      return handleScanCreativityLibrary(args);
    case 'batch_create_creativities':
      return handleBatchCreateCreativities(args);
    case 'smart_edit_creativity':
      return handleSmartEditCreativity(args);
    case 'organize_creativities':
      return handleOrganizeCreativities(args);
    case 'run_script':
      return handleRunScript(args);
    case 'data_transform':
      return handleDataTransform(args);
    case 'preview_creativity':
      return handlePreviewCreativity(args);
    case 'preview_markdown':
      return handlePreviewMarkdown(args);
    case 'generate_and_preview':
      return handleGenerateAndPreview(args);
    case 'search_and_save':
      return handleSearchAndSave(args);
    case 'deep_research':
      return handleDeepResearch(args);

    // ---- 技能系统 ----
    case 'get_skill_prompt': {
      const prompt = skillService.getSkillPrompt(args.skill_id);
      if (prompt) {
        // 记录使用
        skillService.incrementUseCount(args.skill_id).catch(() => {});
        return prompt;
      }
      return `未找到技能: ${args.skill_id}`;
    }
    case 'list_available_skills': {
      const skills = skillService.getAllSkills().filter(s => s.enabled);
      if (args.category) {
        const filtered = skills.filter(s => s.category === args.category);
        if (filtered.length === 0) return `分类"${args.category}"下没有可用技能`;
        return filtered.map(s => `- ${s.icon} ${s.name}（${s.category}）：${s.description} [ID: ${s.id}]`).join('\n');
      }
      if (skills.length === 0) return '当前没有可用的技能';
      // 按分类分组
      const grouped: Record<string, string[]> = {};
      for (const s of skills) {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(`  - ${s.icon} ${s.name}：${s.description} [ID: ${s.id}]`);
      }
      return Object.entries(grouped).map(([cat, items]) => `【${cat}】\n${items.join('\n')}`).join('\n\n');
    }

    // ---- haoone 音视频转录 ----
    case 'check_haoone_environment': {
      const env = haooneService.checkEnvironment();
      const status = [];
      status.push(`CLI可用: ${env.cliAvailable ? '✅' : '❌'}`);
      status.push(`已登录: ${env.loggedIn ? '✅' : '❌'}`);
      status.push(`已激活: ${env.activated ? '✅' : '❌'}`);
      status.push(`已有模型: ${env.hasModels ? '✅' : '❌'}`);
      if (env.installedModels.length > 0) {
        status.push(`已安装模型: ${env.installedModels.map(m => m.name).join(', ')}`);
      }
      status.push(`\n状态: ${env.message}`);
      return status.join('\n');
    }

    case 'haoone_transcribe': {
      if (!args.filePath) return '错误: 缺少必填参数 filePath（音视频文件路径）';
      const result = haooneService.transcribe(args.filePath, {
        outputDir: args.outputDir || null,
        model: args.model || null,
        language: args.language || 'zh',
        timelineName: args.timelineName || null,
        enableAiCorrection: args.enableAiCorrection || false,
        maxSubtitleLength: args.maxSubtitleLength || 25,
      });
      if (result.success) {
        const files = result.files || {};
        const parts = ['✅ 转录完成！'];
        if (files.srtFile) parts.push(`📄 SRT字幕: ${files.srtFile}`);
        if (files.jsonFile) parts.push(`📋 JSON文件: ${files.jsonFile}`);
        return parts.join('\n');
      }
      return `❌ 转录失败: ${result.message}`;
    }

    case 'haoone_batch_transcribe': {
      if (!args.filePaths || !Array.isArray(args.filePaths) || args.filePaths.length === 0) {
        return '错误: 缺少必填参数 filePaths（文件路径数组）';
      }
      const result = haooneService.batchTranscribe(args.filePaths, {
        outputDir: args.outputDir || null,
        model: args.model || null,
        language: args.language || 'zh',
        enableAiCorrection: args.enableAiCorrection !== false,
      });
      if (result.success) {
        return `✅ 批量转录完成！\n${result.output}`;
      }
      return `❌ 批量转录失败: ${result.message}`;
    }

    case 'haoone_list_models': {
      const result = haooneService.listModels();
      if (result.success) {
        if (result.models.length === 0) return '未找到已安装的模型，请先在 haoone 中下载模型';
        const lines = ['已安装的转录模型：'];
        result.models.forEach((m, i) => {
          lines.push(`  ${i + 1}. ${m.name}${m.type ? ` (${m.type})` : ''}`);
        });
        return lines.join('\n');
      }
      return `❌ 获取模型列表失败: ${result.message}`;
    }

    case 'haoone_get_config': {
      const result = haooneService.getConfig();
      if (result.success) {
        const lines = ['haoone 配置信息：'];
        for (const [key, value] of Object.entries(result.config || {})) {
          lines.push(`  ${key}: ${value}`);
        }
        return lines.join('\n');
      }
      return `❌ 获取配置失败: ${result.message}`;
    }

    case 'haoone_create_project': {
      if (!args.projectName) return '错误: 缺少必填参数 projectName（项目名称）';
      const result = haooneService.createProject(args.projectName);
      return result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
    }

    case 'haoone_delete_project': {
      const result = haooneService.deleteProject(args.projectName || null);
      return result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
    }

    case 'haoone_format_draft': {
      if (!args.filePath) return '错误: 缺少必填参数 filePath（文稿文件路径）';
      const result = haooneService.formatDraft(args.filePath);
      if (result.success) {
        return `✅ 文稿格式化完成：\n${result.output}`;
      }
      return `❌ 文稿格式化失败: ${result.message}`;
    }

    case 'haoone_get_project_list': {
      const result = haooneService.getProjectList();
      if (result.success) {
        return result.output || '暂无项目';
      }
      return `❌ 获取项目列表失败: ${result.message}`;
    }

    case 'haoone_get_hotwords': {
      const result = haooneService.getHotwords();
      if (result.success) {
        return result.output || '暂无热词配置';
      }
      return `❌ 获取热词配置失败: ${result.message}`;
    }

    default:
      return `未知工具: ${name}`;
  }
}

// ============================================================
// 各工具的具体实现
// ============================================================

// ---- 原有工具实现 ----

/**
 * 获取当前时间
 */
function handleGetCurrentTime() {
  const now = new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekDay = weekDays[now.getDay()];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `当前时间：${year}年${month}月${day}日 星期${weekDay} ${hours}:${minutes}:${seconds}`;
}

/**
 * 搜索创意库
 */
function handleSearchCreativity(args) {
  try {
    const { keyword, limit = 10 } = args;
    if (!keyword || !keyword.trim()) {
      return '搜索关键词不能为空';
    }

    if (repo.db) {
      const sql = "SELECT * FROM creativities WHERE status = 'active' AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT ?";
      const results = repo.db.prepare(sql).all(`%${keyword}%`, `%${keyword}%`, limit);
      const items = repo.mapRows(results);

      if (items.length === 0) {
        return `未找到与"${keyword}"相关的创意`;
      }

      const formatted = items.map((item, i) => {
        const typeLabel = item.type === 'text' ? '文本' :
          item.type === 'image' ? '图片' :
          item.type === 'audio' ? '音频' :
          item.type === 'video' ? '视频' : item.type;
        const contentPreview = (item.content || '').substring(0, 100);
        return `${i + 1}. [${typeLabel}] ${item.title}\n   ${contentPreview}${(item.content || '').length > 100 ? '...' : ''}`;
      }).join('\n\n');

      return `找到 ${items.length} 条与"${keyword}"相关的创意：\n\n${formatted}`;
    } else {
      const items = (repo.JsonStore.get('creativities') || [])
        .filter(c => c.status === 'active' && (
          (c.title || '').toLowerCase().includes(keyword.toLowerCase()) ||
          (c.content || '').toLowerCase().includes(keyword.toLowerCase())
        ))
        .slice(0, limit);

      if (items.length === 0) {
        return `未找到与"${keyword}"相关的创意`;
      }

      const formatted = items.map((item, i) => {
        const contentPreview = (item.content || '').substring(0, 100);
        return `${i + 1}. ${item.title}\n   ${contentPreview}${(item.content || '').length > 100 ? '...' : ''}`;
      }).join('\n\n');

      return `找到 ${items.length} 条与"${keyword}"相关的创意：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 搜索创意失败:', err.message);
    return `搜索创意失败: ${err.message}`;
  }
}

/**
 * 创建创意
 */
function handleCreateCreativity(args) {
  try {
    const { title, content, type = 'text', subtype } = args;

    if (!title || !title.trim()) {
      return '创意标题不能为空';
    }
    if (!content || !content.trim()) {
      return '创意内容不能为空';
    }

    const creativity = {
      id: repo.generateId(),
      title: title.trim(),
      content: content.trim(),
      type: type || 'text',
      priority: 0,
      emojiReaction: null,
      status: 'active',
      templateId: null,
      boardId: null,
      positionX: null,
      positionY: null,
      cardStyle: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastReviewedAt: null,
      isRead: false,
      isFavorite: false,
      subtype: subtype || null,
      contentFormat: 'plain',
      wordCount: content.length,
      tags: [],
    };

    if (repo.db) {
      repo.db.prepare(
        `INSERT INTO creativities (id, title, content, type, priority, emoji_reaction, status, template_id, board_id, position_x, position_y, card_style, created_at, updated_at, last_reviewed_at, is_read, is_favorite, subtype, content_format, word_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        creativity.id, creativity.title, creativity.content, creativity.type,
        creativity.priority, creativity.emojiReaction, creativity.status,
        creativity.templateId, creativity.boardId, creativity.positionX,
        creativity.positionY, creativity.cardStyle, creativity.createdAt,
        creativity.updatedAt, creativity.lastReviewedAt,
        creativity.isRead ? 1 : 0, creativity.isFavorite ? 1 : 0,
        creativity.subtype || '', creativity.contentFormat || 'plain', creativity.wordCount || 0
      );
    } else {
      repo.JsonStore.get('creativities').push(creativity);
      repo.JsonStore.save();
    }

    return `创意已创建成功！\n标题：${creativity.title}\n类型：${creativity.type}\nID：${creativity.id}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 创建创意失败:', err.message);
    return `创建创意失败: ${err.message}`;
  } finally {
    notifyCreativityChange();
  }
}

/**
 * 获取音乐播放状态
 * 注意：musicStore 是渲染进程 Zustand store，主进程无法直接访问
 * 返回提示信息
 */
function handleGetMusicStatus() {
  try {
    // musicStore 是渲染进程的 Zustand store，主进程无法直接读取播放状态
    // 返回提示信息，建议用户查看播放器界面
    return '音乐播放状态存储在渲染进程中，主进程无法直接获取。请查看应用界面中的音乐播放器获取当前播放状态。';
  } catch (err: any) {
    return `获取音乐状态失败: ${err.message}`;
  }
}

/**
 * 控制音乐播放
 */
function handleControlMusic(args) {
  try {
    const { action } = args;
    const validActions = ['stop', 'pause', 'resume'];

    if (!validActions.includes(action)) {
      return `无效的动作：${action}。支持的动作：${validActions.join(', ')}`;
    }

    const { getMainWindow } = require('../ipc/window');
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('music:control', { action });
    }

    const actionMap = {
      stop: '已停止音乐播放',
      pause: '已暂停音乐播放',
      resume: '已继续音乐播放',
    };

    return actionMap[action] || `已执行 ${action} 操作`;
  } catch (err: any) {
    console.error('[ToolExecutor] 控制音乐失败:', err.message);
    return `控制音乐失败: ${err.message}`;
  }
}

/**
 * 搜索音乐
 */
async function handleSearchMusic(args) {
  try {
    const { keyword, source = 'all' } = args;
    if (!keyword || !keyword.trim()) {
      return '搜索关键词不能为空';
    }

    const results = [];

    // 本地搜索
    if (source === 'local' || source === 'all') {
      try {
        const localTracks = musicLibrary.searchTracks(keyword);
        for (const t of localTracks.slice(0, 5)) {
          results.push(`[本地] 《${t.title}》 - ${t.artist}${t.album ? ` (${t.album})` : ''}`);
        }
      } catch (err) {
        console.warn('[ToolExecutor] 本地音乐搜索失败:', err.message);
      }
    }

    // 在线搜索
    if (source === 'online' || source === 'all') {
      try {
        const onlineResult = await musicOnline.searchSongs(keyword, 1, 5);
        const songs = onlineResult.songs || [];
        for (const s of songs) {
          results.push(`[在线] 《${s.name}》 - ${s.singer}${s.album ? ` (${s.album})` : ''}`);
        }
      } catch (err) {
        console.warn('[ToolExecutor] 在线音乐搜索失败:', err.message);
      }
    }

    if (results.length === 0) {
      return `未找到与"${keyword}"相关的音乐`;
    }

    return `找到 ${results.length} 首相关音乐：\n\n${results.join('\n')}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 搜索音乐失败:', err.message);
    return `搜索音乐失败: ${err.message}`;
  }
}

/**
 * 数学计算
 */
function handleCalculate(args) {
  try {
    const { expression } = args;
    if (!expression || !expression.trim()) {
      return '计算表达式不能为空';
    }

    // 安全检查：只允许数字、运算符、括号、小数点、空格和常见数学函数
    const safePattern = /^[\d\s+\-*/().%^,eE]+$/;
    // 也允许常见数学函数
    const mathFunctions = ['Math.sqrt', 'Math.abs', 'Math.ceil', 'Math.floor', 'Math.round',
      'Math.sin', 'Math.cos', 'Math.tan', 'Math.log', 'Math.log2', 'Math.log10',
      'Math.PI', 'Math.E', 'Math.pow', 'Math.min', 'Math.max', 'Math.random'];
    const normalizedExpr = expression.trim();

    // 替换常见数学写法
    let evalExpr = normalizedExpr
      .replace(/\^/g, '**')           // 幂运算
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/abs\(/g, 'Math.abs(')
      .replace(/ceil\(/g, 'Math.ceil(')
      .replace(/floor\(/g, 'Math.floor(')
      .replace(/round\(/g, 'Math.round(')
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/tan\(/g, 'Math.tan(')
      .replace(/log\(/g, 'Math.log(')
      .replace(/log2\(/g, 'Math.log2(')
      .replace(/log10\(/g, 'Math.log10(')
      .replace(/pow\(/g, 'Math.pow(')
      .replace(/min\(/g, 'Math.min(')
      .replace(/max\(/g, 'Math.max(')
      .replace(/pi/gi, 'Math.PI')
      .replace(/(?<![a-zA-Z])e(?![a-zA-Z])/g, 'Math.E');

    // 安全检查：不允许包含危险字符和关键字
    const dangerousPatterns = [
      /[^0-9+\-*/().%\s,Math.sqrtabsceilflorndsinostaglpwmeEPIx]/,
      /eval|function|var|let|const|import|require|process|global|__dirname|__filename|window|document/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(evalExpr)) {
        return `表达式包含不允许的字符或关键字，仅支持数学运算`;
      }
    }

    // 使用 Function 构造器进行安全计算
    const result = new Function(`"use strict"; return (${evalExpr})`)();

    if (typeof result !== 'number' || !isFinite(result)) {
      return `计算结果无效：${result}`;
    }

    // 格式化结果（避免过长的小数）
    const formattedResult = Number.isInteger(result) ? result : parseFloat(result.toPrecision(12));

    return `${expression} = ${formattedResult}`;
  } catch (err: any) {
    return `计算错误：表达式 "${args.expression}" 无法计算。请检查表达式格式是否正确。`;
  }
}

/**
 * 联网搜索
 */
async function handleWebSearch(args) {
  try {
    const { query } = args;
    if (!query || !query.trim()) {
      return '搜索内容不能为空';
    }

    const result = await webSearch(query);
    return result;
  } catch (err: any) {
    console.error('[ToolExecutor] 联网搜索失败:', err.message);
    return `联网搜索失败: ${err.message}`;
  }
}

/**
 * 执行代码
 */
async function handleExecuteCode(args) {
  try {
    const { code, language = 'javascript' } = args;
    const result = await codeExecutor.executeCode(code, language);
    if (result.success) {
      return `执行成功：\n${result.output}`;
    }
    return `执行失败：${result.error}`;
  } catch (err) {
    return `代码执行错误: ${err.message}`;
  }
}

/**
 * 读取文件
 */
function handleReadFile(args) {
  try {
    const result = fileOps.readFile(args.path);
    if (result.success) {
      return `文件内容（${(result.data.size / 1024).toFixed(1)}KB）：\n${result.data.content}`;
    }
    return `读取失败：${result.error}`;
  } catch (err) {
    return `读取文件错误: ${err.message}`;
  }
}

/**
 * 列出目录
 */
function handleListDirectory(args) {
  try {
    const result = fileOps.listDirectory(args.path);
    if (result.success) {
      const items = result.data.map(item => {
        const sizeStr = item.isFile ? ` (${(item.size / 1024).toFixed(1)}KB)` : '';
        return `${item.isDirectory ? '📁' : '📄'} ${item.name}${sizeStr}`;
      }).join('\n');
      return `目录内容：\n${items}`;
    }
    return `列出目录失败：${result.error}`;
  } catch (err) {
    return `列出目录错误: ${err.message}`;
  }
}

// ---- 新增工具实现：创意管理 ----

/**
 * 更新创意
 */
function handleUpdateCreativity(args) {
  try {
    const { id, title, content, type, subtype } = args;

    if (!id || !id.trim()) {
      return '创意 ID 不能为空';
    }

    // 检查创意是否存在
    if (repo.db) {
      const existing = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(id);
      if (!existing) {
        return `未找到 ID 为 "${id}" 的创意`;
      }

      // 构建动态更新语句
      const updates = [];
      const values = [];

      if (title !== undefined && title !== null) {
        updates.push('title = ?');
        values.push(title.trim());
      }
      if (content !== undefined && content !== null) {
        updates.push('content = ?');
        values.push(content.trim());
        updates.push('word_count = ?');
        values.push(content.length);
      }
      if (type !== undefined && type !== null) {
        updates.push('type = ?');
        values.push(type);
      }
      if (subtype !== undefined && subtype !== null) {
        updates.push('subtype = ?');
        values.push(subtype);
      }

      if (updates.length === 0) {
        return '没有提供需要更新的字段';
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      const sql = `UPDATE creativities SET ${updates.join(', ')} WHERE id = ?`;
      repo.db.prepare(sql).run(...values);

      // 获取更新后的数据
      const updated = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(id);
      const item = repo.mapRow ? repo.mapRow(updated) : updated;

      return `创意已更新成功！\n标题：${item.title}\n类型：${item.type}\nID：${item.id}`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const index = creativities.findIndex(c => c.id === id);
      if (index === -1) {
        return `未找到 ID 为 "${id}" 的创意`;
      }

      if (title !== undefined && title !== null) creativities[index].title = title.trim();
      if (content !== undefined && content !== null) {
        creativities[index].content = content.trim();
        creativities[index].wordCount = content.length;
      }
      if (type !== undefined && type !== null) creativities[index].type = type;
      if (subtype !== undefined && subtype !== null) creativities[index].subtype = subtype;
      creativities[index].updatedAt = new Date().toISOString();

      repo.JsonStore.save();

      return `创意已更新成功！\n标题：${creativities[index].title}\n类型：${creativities[index].type}\nID：${creativities[index].id}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 更新创意失败:', err.message);
    return `更新创意失败: ${err.message}`;
  } finally {
    notifyCreativityChange();
  }
}

/**
 * 软删除创意（设置状态为 trashed）
 */
function handleDeleteCreativity(args) {
  try {
    const { id } = args;

    if (!id || !id.trim()) {
      return '创意 ID 不能为空';
    }

    if (repo.db) {
      const existing = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(id);
      if (!existing) {
        return `未找到 ID 为 "${id}" 的创意`;
      }

      if (existing.status === 'trashed') {
        return `创意 "${existing.title}" 已经在回收站中`;
      }

      repo.db.prepare(
        "UPDATE creativities SET status = 'trashed', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), id);

      return `创意 "${existing.title}" 已移至回收站`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const index = creativities.findIndex(c => c.id === id);
      if (index === -1) {
        return `未找到 ID 为 "${id}" 的创意`;
      }

      if (creativities[index].status === 'trashed') {
        return `创意 "${creativities[index].title}" 已经在回收站中`;
      }

      creativities[index].status = 'trashed';
      creativities[index].updatedAt = new Date().toISOString();
      repo.JsonStore.save();

      return `创意 "${creativities[index].title}" 已移至回收站`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 删除创意失败:', err.message);
    return `删除创意失败: ${err.message}`;
  } finally {
    notifyCreativityChange();
  }
}

/**
 * 获取创意详情
 */
function handleGetCreativityDetail(args) {
  try {
    const { id } = args;

    if (!id || !id.trim()) {
      return '创意 ID 不能为空';
    }

    if (repo.db) {
      const row = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(id);
      if (!row) {
        return `未找到 ID 为 "${id}" 的创意`;
      }

      const item = repo.mapRow ? repo.mapRow(row) : row;

      // 获取关联标签
      let tagNames = [];
      try {
        const tagRows = repo.db.prepare(
          `SELECT t.name FROM tags t
           INNER JOIN creativity_tags ct ON t.id = ct.tag_id
           WHERE ct.creativity_id = ?`
        ).all(id);
        tagNames = tagRows.map(tr => tr.name);
      } catch (e) {
        // creativity_tags 表可能不存在
      }

      const typeLabel = item.type === 'text' ? '文本' :
        item.type === 'image' ? '图片' :
        item.type === 'audio' ? '音频' :
        item.type === 'video' ? '视频' :
        item.type === 'document' ? '文档' : item.type;

      const statusLabel = item.status === 'active' ? '活跃' :
        item.status === 'trashed' ? '回收站' :
        item.status === 'archived' ? '归档' : item.status;

      let detail = `创意详情：\n`;
      detail += `━━━━━━━━━━━━━━━━━━━━\n`;
      detail += `标题：${item.title}\n`;
      detail += `类型：${typeLabel}\n`;
      detail += `状态：${statusLabel}\n`;
      if (item.subtype) detail += `子类型：${item.subtype}\n`;
      detail += `创建时间：${item.createdAt}\n`;
      detail += `更新时间：${item.updatedAt}\n`;
      if (tagNames.length > 0) detail += `标签：${tagNames.join(', ')}\n`;
      detail += `━━━━━━━━━━━━━━━━━━━━\n`;
      detail += `内容：\n${item.content}`;

      return detail;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const item = creativities.find(c => c.id === id);
      if (!item) {
        return `未找到 ID 为 "${id}" 的创意`;
      }

      const tags = item.tags || [];

      let detail = `创意详情：\n`;
      detail += `━━━━━━━━━━━━━━━━━━━━\n`;
      detail += `标题：${item.title}\n`;
      detail += `类型：${item.type}\n`;
      detail += `状态：${item.status}\n`;
      if (item.subtype) detail += `子类型：${item.subtype}\n`;
      detail += `创建时间：${item.createdAt}\n`;
      detail += `更新时间：${item.updatedAt}\n`;
      if (tags.length > 0) detail += `标签：${tags.join(', ')}\n`;
      detail += `━━━━━━━━━━━━━━━━━━━━\n`;
      detail += `内容：\n${item.content}`;

      return detail;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取创意详情失败:', err.message);
    return `获取创意详情失败: ${err.message}`;
  }
}

/**
 * 分页列出创意
 */
function handleListCreativities(args) {
  try {
    const { page = 1, pageSize = 20, type, status, sortBy = 'updated_at' } = args;

    const pageNum = Math.max(1, page);
    const sizeNum = Math.max(1, Math.min(100, pageSize));
    const offset = (pageNum - 1) * sizeNum;

    // 验证排序字段
    const validSortFields = ['created_at', 'updated_at', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updated_at';

    if (repo.db) {
      // 构建动态查询
      const conditions = [];
      const values = [];

      if (type) {
        conditions.push('type = ?');
        values.push(type);
      }
      if (status) {
        conditions.push('status = ?');
        values.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 获取总数
      const countSql = `SELECT COUNT(*) as total FROM creativities ${whereClause}`;
      const countResult = repo.db.prepare(countSql).get(...values);
      const total = countResult.total;

      // 获取分页数据
      const dataSql = `SELECT * FROM creativities ${whereClause} ORDER BY ${sortField} DESC LIMIT ? OFFSET ?`;
      const rows = repo.db.prepare(dataSql).all(...values, sizeNum, offset);
      const items = repo.mapRows ? repo.mapRows(rows) : rows;

      if (items.length === 0) {
        return `没有找到符合条件的创意（共 ${total} 条记录）`;
      }

      const formatted = items.map((item, i) => {
        const typeLabel = item.type === 'text' ? '文本' :
          item.type === 'image' ? '图片' :
          item.type === 'audio' ? '音频' :
          item.type === 'video' ? '视频' :
          item.type === 'document' ? '文档' : item.type;
        const contentPreview = (item.content || '').substring(0, 80);
        return `${offset + i + 1}. [${typeLabel}] ${item.title}\n   ${contentPreview}${(item.content || '').length > 80 ? '...' : ''}`;
      }).join('\n\n');

      const totalPages = Math.ceil(total / sizeNum);
      return `创意列表（第 ${pageNum}/${totalPages} 页，共 ${total} 条）：\n\n${formatted}`;
    } else {
      let items = repo.JsonStore.get('creativities') || [];

      if (type) items = items.filter(c => c.type === type);
      if (status) items = items.filter(c => c.status === status);

      // 排序
      items.sort((a, b) => {
        if (sortField === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        }
        return new Date(b[sortField] || 0).getTime() - new Date(a[sortField] || 0).getTime();
      });

      const total = items.length;
      const pagedItems = items.slice(offset, offset + sizeNum);

      if (pagedItems.length === 0) {
        return `没有找到符合条件的创意（共 ${total} 条记录）`;
      }

      const formatted = pagedItems.map((item, i) => {
        const contentPreview = (item.content || '').substring(0, 80);
        return `${offset + i + 1}. [${item.type}] ${item.title}\n   ${contentPreview}${(item.content || '').length > 80 ? '...' : ''}`;
      }).join('\n\n');

      const totalPages = Math.ceil(total / sizeNum);
      return `创意列表（第 ${pageNum}/${totalPages} 页，共 ${total} 条）：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 列出创意失败:', err.message);
    return `列出创意失败: ${err.message}`;
  }
}

/**
 * 为创意添加标签
 */
function handleTagCreativity(args) {
  try {
    const { creativityId, tags } = args;

    if (!creativityId || !creativityId.trim()) {
      return '创意 ID 不能为空';
    }
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return '标签数组不能为空';
    }

    // 检查创意是否存在
    if (repo.db) {
      const creativity = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!creativity) {
        return `未找到 ID 为 "${creativityId}" 的创意`;
      }

      const createdTags = [];
      const associatedTags = [];

      for (const tagName of tags) {
        const trimmedName = tagName.trim();
        if (!trimmedName) continue;

        // 检查标签是否存在，不存在则创建
        let tag = repo.db.prepare("SELECT * FROM tags WHERE name = ?").get(trimmedName);
        if (!tag) {
          const tagId = repo.generateId();
          repo.db.prepare(
            "INSERT INTO tags (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)"
          ).run(tagId, trimmedName, null, null, new Date().toISOString());
          tag = { id: tagId, name: trimmedName };
          createdTags.push(trimmedName);
        }

        // 检查关联是否已存在
        const existing = repo.db.prepare(
          "SELECT * FROM creativity_tags WHERE creativity_id = ? AND tag_id = ?"
        ).get(creativityId, tag.id);

        if (!existing) {
          repo.db.prepare(
            "INSERT INTO creativity_tags (creativity_id, tag_id, created_at) VALUES (?, ?, ?)"
          ).run(creativityId, tag.id, new Date().toISOString());
          associatedTags.push(trimmedName);
        }
      }

      let result = `标签操作完成！\n`;
      if (createdTags.length > 0) {
        result += `新创建的标签：${createdTags.join(', ')}\n`;
      }
      if (associatedTags.length > 0) {
        result += `已关联的标签：${associatedTags.join(', ')}`;
      }
      if (createdTags.length === 0 && associatedTags.length === 0) {
        result += '所有标签均已存在且已关联';
      }

      return result;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const index = creativities.findIndex(c => c.id === creativityId);
      if (index === -1) {
        return `未找到 ID 为 "${creativityId}" 的创意`;
      }

      const allTags = repo.JsonStore.get('tags') || [];
      const currentTags = creativities[index].tags || [];
      const newTags = [];

      for (const tagName of tags) {
        const trimmedName = tagName.trim();
        if (!trimmedName) continue;

        // 检查标签是否存在
        if (!allTags.find(t => t.name === trimmedName)) {
          allTags.push({
            id: repo.generateId(),
            name: trimmedName,
            color: null,
            icon: null,
            createdAt: new Date().toISOString(),
          });
        }

        // 关联标签
        if (!currentTags.includes(trimmedName)) {
          currentTags.push(trimmedName);
          newTags.push(trimmedName);
        }
      }

      creativities[index].tags = currentTags;
      creativities[index].updatedAt = new Date().toISOString();
      repo.JsonStore.set('tags', allTags);
      repo.JsonStore.save();

      return `标签操作完成！\n已关联的标签：${newTags.length > 0 ? newTags.join(', ') : '所有标签均已存在且已关联'}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 标签操作失败:', err.message);
    return `标签操作失败: ${err.message}`;
  }
}

/**
 * 关联两条创意
 */
function handleLinkCreativities(args) {
  try {
    const { sourceId, targetId, relationType = 'related' } = args;

    if (!sourceId || !sourceId.trim()) {
      return '源创意 ID 不能为空';
    }
    if (!targetId || !targetId.trim()) {
      return '目标创意 ID 不能为空';
    }
    if (sourceId === targetId) {
      return '源创意和目标创意不能是同一条';
    }

    const validRelationTypes = ['related', 'derived', 'combined'];
    const relType = validRelationTypes.includes(relationType) ? relationType : 'related';

    const relationLabels = {
      related: '相关',
      derived: '衍生',
      combined: '组合',
    };

    if (repo.db) {
      // 检查两个创意是否存在
      const source = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(sourceId);
      const target = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(targetId);

      if (!source) {
        return `未找到源创意（ID: "${sourceId}"）`;
      }
      if (!target) {
        return `未找到目标创意（ID: "${targetId}"）`;
      }

      // 检查关联是否已存在
      const existing = repo.db.prepare(
        "SELECT * FROM creativity_links WHERE source_id = ? AND target_id = ? AND relation_type = ?"
      ).get(sourceId, targetId, relType);

      if (existing) {
        return `"${source.title}" 和 "${target.title}" 之间已存在 "${relationLabels[relType]}" 关联`;
      }

      // 创建关联
      repo.db.prepare(
        "INSERT INTO creativity_links (id, source_id, target_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(repo.generateId(), sourceId, targetId, relType, new Date().toISOString());

      return `已创建关联：\n"${source.title}" --[${relationLabels[relType]}]--> "${target.title}"`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const source = creativities.find(c => c.id === sourceId);
      const target = creativities.find(c => c.id === targetId);

      if (!source) {
        return `未找到源创意（ID: "${sourceId}"）`;
      }
      if (!target) {
        return `未找到目标创意（ID: "${targetId}"）`;
      }

      const links = repo.JsonStore.get('creativity_links') || [];
      const exists = links.find(
        l => l.source_id === sourceId && l.target_id === targetId && l.relation_type === relType
      );

      if (exists) {
        return `"${source.title}" 和 "${target.title}" 之间已存在 "${relationLabels[relType]}" 关联`;
      }

      links.push({
        id: repo.generateId(),
        source_id: sourceId,
        target_id: targetId,
        relation_type: relType,
        created_at: new Date().toISOString(),
      });
      repo.JsonStore.set('creativity_links', links);
      repo.JsonStore.save();

      return `已创建关联：\n"${source.title}" --[${relationLabels[relType]}]--> "${target.title}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 关联创意失败:', err.message);
    return `关联创意失败: ${err.message}`;
  }
}

// ---- 新增工具实现：画板管理 ----

/**
 * 创建画板
 */
function handleCreateBoard(args) {
  try {
    const { name, description, layout = 'free' } = args;

    if (!name || !name.trim()) {
      return '画板名称不能为空';
    }

    const board = {
      id: repo.generateId(),
      name: name.trim(),
      description: description ? description.trim() : null,
      layout: layout || 'free',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (repo.db) {
      repo.db.prepare(
        "INSERT INTO boards (id, name, description, layout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(board.id, board.name, board.description, board.layout, board.createdAt, board.updatedAt);
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      boards.push(board);
      repo.JsonStore.set('boards', boards);
      repo.JsonStore.save();
    }

    return `画板已创建成功！\n名称：${board.name}\n布局：${board.layout}\nID：${board.id}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 创建画板失败:', err.message);
    return `创建画板失败: ${err.message}`;
  }
}

/**
 * 将创意添加到画板
 */
function handleAddToBoard(args) {
  try {
    const { boardId, creativityId } = args;

    if (!boardId || !boardId.trim()) {
      return '画板 ID 不能为空';
    }
    if (!creativityId || !creativityId.trim()) {
      return '创意 ID 不能为空';
    }

    if (repo.db) {
      // 检查画板是否存在
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) {
        return `未找到 ID 为 "${boardId}" 的画板`;
      }

      // 检查创意是否存在
      const creativity = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!creativity) {
        return `未找到 ID 为 "${creativityId}" 的创意`;
      }

      // 检查是否已在画板中
      const existing = repo.db.prepare(
        "SELECT * FROM creativities WHERE id = ? AND board_id = ?"
      ).get(creativityId, boardId);

      if (existing) {
        return `创意 "${creativity.title}" 已在画板 "${board.name}" 中`;
      }

      // 将创意添加到画板
      repo.db.prepare(
        "UPDATE creativities SET board_id = ?, updated_at = ? WHERE id = ?"
      ).run(boardId, new Date().toISOString(), creativityId);

      return `已将创意 "${creativity.title}" 添加到画板 "${board.name}"`;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const board = boards.find(b => b.id === boardId);
      if (!board) {
        return `未找到 ID 为 "${boardId}" 的画板`;
      }

      const creativities = repo.JsonStore.get('creativities') || [];
      const creativity = creativities.find(c => c.id === creativityId);
      if (!creativity) {
        return `未找到 ID 为 "${creativityId}" 的创意`;
      }

      if (creativity.boardId === boardId) {
        return `创意 "${creativity.title}" 已在画板 "${board.name}" 中`;
      }

      creativity.boardId = boardId;
      creativity.updatedAt = new Date().toISOString();
      repo.JsonStore.save();

      return `已将创意 "${creativity.title}" 添加到画板 "${board.name}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 添加到画板失败:', err.message);
    return `添加到画板失败: ${err.message}`;
  }
}

/**
 * 获取画板概览
 */
function handleGetBoardOverview(args) {
  try {
    const { boardId } = args;

    if (!boardId || !boardId.trim()) {
      return '画板 ID 不能为空';
    }

    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) {
        return `未找到 ID 为 "${boardId}" 的画板`;
      }

      // 统计画板中的创意数量
      const countResult = repo.db.prepare(
        "SELECT COUNT(*) as count FROM creativities WHERE board_id = ? AND status = 'active'"
      ).get(boardId);
      const itemCount = countResult.count;

      // 获取画板中的创意列表（最多显示 10 条）
      const items = repo.db.prepare(
        "SELECT id, title, type FROM creativities WHERE board_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 10"
      ).all(boardId);

      let overview = `画板概览：\n`;
      overview += `━━━━━━━━━━━━━━━━━━━━\n`;
      overview += `名称：${board.name}\n`;
      if (board.description) overview += `描述：${board.description}\n`;
      overview += `布局：${board.layout}\n`;
      overview += `创意数量：${itemCount}\n`;
      overview += `创建时间：${board.createdAt}\n`;
      overview += `更新时间：${board.updated_at}\n`;
      overview += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (items.length > 0) {
        overview += `创意列表（最多显示 10 条）：\n`;
        items.forEach((item, i) => {
          const typeLabel = item.type === 'text' ? '文本' :
            item.type === 'image' ? '图片' :
            item.type === 'audio' ? '音频' :
            item.type === 'video' ? '视频' :
            item.type === 'document' ? '文档' : item.type;
          overview += `${i + 1}. [${typeLabel}] ${item.title}\n`;
        });
        if (itemCount > 10) {
          overview += `... 还有 ${itemCount - 10} 条创意`;
        }
      } else {
        overview += `画板中暂无创意`;
      }

      return overview;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const board = boards.find(b => b.id === boardId);
      if (!board) {
        return `未找到 ID 为 "${boardId}" 的画板`;
      }

      const creativities = repo.JsonStore.get('creativities') || [];
      const items = creativities.filter(c => c.boardId === boardId && c.status === 'active');
      const itemCount = items.length;

      let overview = `画板概览：\n`;
      overview += `━━━━━━━━━━━━━━━━━━━━\n`;
      overview += `名称：${board.name}\n`;
      if (board.description) overview += `描述：${board.description}\n`;
      overview += `布局：${board.layout}\n`;
      overview += `创意数量：${itemCount}\n`;
      overview += `创建时间：${board.createdAt}\n`;
      overview += `更新时间：${board.updatedAt}\n`;
      overview += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (items.length > 0) {
        overview += `创意列表（最多显示 10 条）：\n`;
        items.slice(0, 10).forEach((item, i) => {
          overview += `${i + 1}. [${item.type}] ${item.title}\n`;
        });
        if (itemCount > 10) {
          overview += `... 还有 ${itemCount - 10} 条创意`;
        }
      } else {
        overview += `画板中暂无创意`;
      }

      return overview;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取画板概览失败:', err.message);
    return `获取画板概览失败: ${err.message}`;
  }
}

// ---- 新增工具实现：标签管理 ----

/**
 * 创建标签
 */
function handleCreateTag(args) {
  try {
    const { name, color, icon } = args;

    if (!name || !name.trim()) {
      return '标签名称不能为空';
    }

    const tagName = name.trim();

    if (repo.db) {
      // 检查标签是否已存在
      const existing = repo.db.prepare("SELECT * FROM tags WHERE name = ?").get(tagName);
      if (existing) {
        return `标签 "${tagName}" 已存在`;
      }

      const tagId = repo.generateId();
      repo.db.prepare(
        "INSERT INTO tags (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(tagId, tagName, color || null, icon || null, new Date().toISOString());

      return `标签已创建成功！\n名称：${tagName}\nID：${tagId}`;
    } else {
      const tags = repo.JsonStore.get('tags') || [];
      const existing = tags.find(t => t.name === tagName);
      if (existing) {
        return `标签 "${tagName}" 已存在`;
      }

      const tag = {
        id: repo.generateId(),
        name: tagName,
        color: color || null,
        icon: icon || null,
        createdAt: new Date().toISOString(),
      };
      tags.push(tag);
      repo.JsonStore.set('tags', tags);
      repo.JsonStore.save();

      return `标签已创建成功！\n名称：${tagName}\nID：${tag.id}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 创建标签失败:', err.message);
    return `创建标签失败: ${err.message}`;
  }
}

/**
 * 搜索标签
 */
function handleSearchTags(args) {
  try {
    const { keyword } = args;

    if (!keyword || !keyword.trim()) {
      return '搜索关键词不能为空';
    }

    if (repo.db) {
      const rows = repo.db.prepare(
        "SELECT * FROM tags WHERE name LIKE ? ORDER BY name ASC LIMIT 20"
      ).all(`%${keyword}%`);

      if (rows.length === 0) {
        return `未找到与"${keyword}"相关的标签`;
      }

      const formatted = rows.map((row, i) => {
        const colorInfo = row.color ? ` (${row.color})` : '';
        return `${i + 1}. ${row.name}${colorInfo}`;
      }).join('\n');

      return `找到 ${rows.length} 个与"${keyword}"相关的标签：\n\n${formatted}`;
    } else {
      const tags = repo.JsonStore.get('tags') || [];
      const matched = tags
        .filter(t => t.name.toLowerCase().includes(keyword.toLowerCase()))
        .slice(0, 20);

      if (matched.length === 0) {
        return `未找到与"${keyword}"相关的标签`;
      }

      const formatted = matched.map((tag, i) => {
        const colorInfo = tag.color ? ` (${tag.color})` : '';
        return `${i + 1}. ${tag.name}${colorInfo}`;
      }).join('\n');

      return `找到 ${matched.length} 个与"${keyword}"相关的标签：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 搜索标签失败:', err.message);
    return `搜索标签失败: ${err.message}`;
  }
}

/**
 * 获取热门标签
 */
function handleGetPopularTags(args) {
  try {
    const { limit = 10 } = args;
    const limitNum = Math.max(1, Math.min(50, limit));

    if (repo.db) {
      try {
        const rows = repo.db.prepare(
          `SELECT t.name, COUNT(ct.creativity_id) as usage_count
           FROM tags t
           INNER JOIN creativity_tags ct ON t.id = ct.tag_id
           GROUP BY t.id
           ORDER BY usage_count DESC
           LIMIT ?`
        ).all(limitNum);

        if (rows.length === 0) {
          return '暂无标签使用数据';
        }

        const formatted = rows.map((row, i) => {
          return `${i + 1}. ${row.name}（使用 ${row.usage_count} 次）`;
        }).join('\n');

        return `热门标签 TOP ${rows.length}：\n\n${formatted}`;
      } catch (e) {
        // creativity_tags 表可能不存在
        return '暂无标签使用数据';
      }
    } else {
      const tags = repo.JsonStore.get('tags') || [];
      const creativities = repo.JsonStore.get('creativities') || [];

      // 统计每个标签的使用次数
      const tagCount = {};
      for (const c of creativities) {
        const cTags = c.tags || [];
        for (const t of cTags) {
          tagCount[t] = (tagCount[t] || 0) + 1;
        }
      }

      // 按使用次数排序
      const sorted = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limitNum);

      if (sorted.length === 0) {
        return '暂无标签使用数据';
      }

      const formatted = sorted.map(([name, count], i) => {
        return `${i + 1}. ${name}（使用 ${count} 次）`;
      }).join('\n');

      return `热门标签 TOP ${sorted.length}：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取热门标签失败:', err.message);
    return `获取热门标签失败: ${err.message}`;
  }
}

// ---- 新增工具实现：搜索 ----

/**
 * 搜索模板
 */
function handleSearchTemplates(args) {
  try {
    const { keyword } = args;

    if (!keyword || !keyword.trim()) {
      return '搜索关键词不能为空';
    }

    if (repo.db) {
      try {
        const rows = repo.db.prepare(
          "SELECT * FROM templates WHERE name LIKE ? OR description LIKE ? ORDER BY name ASC LIMIT 20"
        ).all(`%${keyword}%`, `%${keyword}%`);

        if (rows.length === 0) {
          return `未找到与"${keyword}"相关的模板`;
        }

        const formatted = rows.map((row, i) => {
          const desc = row.description ? `\n   ${row.description.substring(0, 80)}` : '';
          return `${i + 1}. ${row.name}${desc}`;
        }).join('\n');

        return `找到 ${rows.length} 个与"${keyword}"相关的模板：\n\n${formatted}`;
      } catch (e) {
        // templates 表可能不存在
        return `未找到与"${keyword}"相关的模板`;
      }
    } else {
      const templates = repo.JsonStore.get('templates') || [];
      const matched = templates
        .filter(t =>
          (t.name || '').toLowerCase().includes(keyword.toLowerCase()) ||
          (t.description || '').toLowerCase().includes(keyword.toLowerCase())
        )
        .slice(0, 20);

      if (matched.length === 0) {
        return `未找到与"${keyword}"相关的模板`;
      }

      const formatted = matched.map((t, i) => {
        const desc = t.description ? `\n   ${t.description.substring(0, 80)}` : '';
        return `${i + 1}. ${t.name}${desc}`;
      }).join('\n');

      return `找到 ${matched.length} 个与"${keyword}"相关的模板：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 搜索模板失败:', err.message);
    return `搜索模板失败: ${err.message}`;
  }
}

/**
 * 全局搜索
 */
function handleGlobalSearch(args) {
  try {
    const { keyword, limit = 20 } = args;

    if (!keyword || !keyword.trim()) {
      return '搜索关键词不能为空';
    }

    const limitNum = Math.max(1, Math.min(100, limit));
    const results = [];

    if (repo.db) {
      // 搜索创意
      try {
        const creativityRows = repo.db.prepare(
          "SELECT id, title, type, 'creativity' as source FROM creativities WHERE status = 'active' AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT ?"
        ).all(`%${keyword}%`, `%${keyword}%`, limitNum);

        for (const row of creativityRows) {
          const typeLabel = row.type === 'text' ? '文本' :
            row.type === 'image' ? '图片' :
            row.type === 'audio' ? '音频' :
            row.type === 'video' ? '视频' :
            row.type === 'document' ? '文档' : row.type;
          results.push(`[创意] ${row.title}（${typeLabel}）`);
        }
      } catch (e) {
        // 忽略错误
      }

      // 搜索画板
      try {
        const boardRows = repo.db.prepare(
          "SELECT id, name, 'board' as source FROM boards WHERE name LIKE ? OR description LIKE ? ORDER BY updated_at DESC LIMIT ?"
        ).all(`%${keyword}%`, `%${keyword}%`, limitNum);

        for (const row of boardRows) {
          results.push(`[画板] ${row.name}`);
        }
      } catch (e) {
        // 忽略错误
      }

      // 搜索标签
      try {
        const tagRows = repo.db.prepare(
          "SELECT id, name, 'tag' as source FROM tags WHERE name LIKE ? ORDER BY name ASC LIMIT ?"
        ).all(`%${keyword}%`, limitNum);

        for (const row of tagRows) {
          results.push(`[标签] ${row.name}`);
        }
      } catch (e) {
        // 忽略错误
      }
    } else {
      // JSON 存储模式
      const creativities = (repo.JsonStore.get('creativities') || [])
        .filter(c => c.status === 'active' && (
          (c.title || '').toLowerCase().includes(keyword.toLowerCase()) ||
          (c.content || '').toLowerCase().includes(keyword.toLowerCase())
        ))
        .slice(0, limitNum);

      for (const c of creativities) {
        results.push(`[创意] ${c.title}（${c.type}）`);
      }

      const boards = (repo.JsonStore.get('boards') || [])
        .filter(b =>
          (b.name || '').toLowerCase().includes(keyword.toLowerCase()) ||
          (b.description || '').toLowerCase().includes(keyword.toLowerCase())
        )
        .slice(0, limitNum);

      for (const b of boards) {
        results.push(`[画板] ${b.name}`);
      }

      const tags = (repo.JsonStore.get('tags') || [])
        .filter(t => (t.name || '').toLowerCase().includes(keyword.toLowerCase()))
        .slice(0, limitNum);

      for (const t of tags) {
        results.push(`[标签] ${t.name}`);
      }
    }

    if (results.length === 0) {
      return `全局搜索未找到与"${keyword}"相关的结果`;
    }

    const formatted = results.slice(0, limitNum).map((r, i) => `${i + 1}. ${r}`).join('\n');

    return `全局搜索结果（共 ${results.length} 条）：\n\n${formatted}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 全局搜索失败:', err.message);
    return `全局搜索失败: ${err.message}`;
  }
}

/**
 * 按日期范围搜索创意
 */
function handleSearchByDateRange(args) {
  try {
    const { dateFrom, dateTo, limit = 20 } = args;
    const limitNum = Math.max(1, Math.min(100, limit));

    if (!dateFrom && !dateTo) {
      return '请至少提供起始日期或结束日期';
    }

    // 验证日期格式
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    if (fromDate && isNaN(fromDate.getTime())) {
      return `起始日期格式无效：${dateFrom}，请使用 ISO 格式（如 2025-01-01）`;
    }
    if (toDate && isNaN(toDate.getTime())) {
      return `结束日期格式无效：${dateTo}，请使用 ISO 格式（如 2025-12-31）`;
    }

    // 设置日期范围边界
    const fromISO = fromDate ? fromDate.toISOString() : '1970-01-01T00:00:00.000Z';
    const toISO = toDate ? new Date(toDate.getTime() + 86400000).toISOString() : '9999-12-31T23:59:59.999Z';

    if (repo.db) {
      const rows = repo.db.prepare(
        "SELECT * FROM creativities WHERE status = 'active' AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT ?"
      ).all(fromISO, toISO, limitNum);

      const items = repo.mapRows ? repo.mapRows(rows) : rows;

      if (items.length === 0) {
        return `未找到 ${dateFrom || '最早'} 至 ${dateTo || '现在'} 之间的创意`;
      }

      const formatted = items.map((item, i) => {
        const typeLabel = item.type === 'text' ? '文本' :
          item.type === 'image' ? '图片' :
          item.type === 'audio' ? '音频' :
          item.type === 'video' ? '视频' :
          item.type === 'document' ? '文档' : item.type;
        const createdDate = (item.createdAt || '').substring(0, 10);
        return `${i + 1}. [${typeLabel}] ${item.title}\n   创建于：${createdDate}`;
      }).join('\n\n');

      return `找到 ${items.length} 条创意（${dateFrom || '最早'} ~ ${dateTo || '现在'}）：\n\n${formatted}`;
    } else {
      const creativities = (repo.JsonStore.get('creativities') || [])
        .filter(c => {
          if (c.status !== 'active') return false;
          const created = new Date(c.createdAt);
          if (fromDate && created < fromDate) return false;
          if (toDate && created > new Date(toDate.getTime() + 86400000)) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitNum);

      if (creativities.length === 0) {
        return `未找到 ${dateFrom || '最早'} 至 ${dateTo || '现在'} 之间的创意`;
      }

      const formatted = creativities.map((item, i) => {
        const createdDate = (item.createdAt || '').substring(0, 10);
        return `${i + 1}. [${item.type}] ${item.title}\n   创建于：${createdDate}`;
      }).join('\n\n');

      return `找到 ${creativities.length} 条创意（${dateFrom || '最早'} ~ ${dateTo || '现在'}）：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 按日期搜索失败:', err.message);
    return `按日期搜索失败: ${err.message}`;
  }
}

// ---- 新增工具实现：统计与历史 ----

/**
 * 获取应用统计
 */
function handleGetAppStats() {
  try {
    if (repo.db) {
      const creativityCount = repo.db.prepare(
        "SELECT COUNT(*) as count FROM creativities WHERE status = 'active'"
      ).get().count;

      const trashedCount = repo.db.prepare(
        "SELECT COUNT(*) as count FROM creativities WHERE status = 'trashed'"
      ).get().count;

      const boardCount = repo.db.prepare(
        "SELECT COUNT(*) as count FROM boards"
      ).get().count;

      let tagCount = 0;
      try {
        tagCount = repo.db.prepare("SELECT COUNT(*) as count FROM tags").get().count;
      } catch (e) {
        // tags 表可能不存在
      }

      let linkCount = 0;
      try {
        linkCount = repo.db.prepare("SELECT COUNT(*) as count FROM creativity_links").get().count;
      } catch (e) {
        // creativity_links 表可能不存在
      }

      // 按类型统计
      const typeStats = repo.db.prepare(
        "SELECT type, COUNT(*) as count FROM creativities WHERE status = 'active' GROUP BY type ORDER BY count DESC"
      ).all();

      const typeLabels = {
        text: '文本',
        image: '图片',
        audio: '音频',
        video: '视频',
        document: '文档',
      };

      let typeBreakdown = '';
      if (typeStats.length > 0) {
        typeBreakdown = '\n各类型统计：\n';
        for (const ts of typeStats) {
          const label = typeLabels[ts.type] || ts.type;
          typeBreakdown += `  - ${label}：${ts.count} 条\n`;
        }
      }

      return `应用统计：\n━━━━━━━━━━━━━━━━━━━━\n活跃创意：${creativityCount} 条\n回收站：${trashedCount} 条\n画板：${boardCount} 个\n标签：${tagCount} 个\n创意关联：${linkCount} 条${typeBreakdown}`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const boards = repo.JsonStore.get('boards') || [];
      const tags = repo.JsonStore.get('tags') || [];
      const links = repo.JsonStore.get('creativity_links') || [];

      const activeCount = creativities.filter(c => c.status === 'active').length;
      const trashedCount = creativities.filter(c => c.status === 'trashed').length;

      // 按类型统计
      const typeMap = {};
      for (const c of creativities) {
        if (c.status === 'active') {
          typeMap[c.type] = (typeMap[c.type] || 0) + 1;
        }
      }

      const typeLabels = {
        text: '文本',
        image: '图片',
        audio: '音频',
        video: '视频',
        document: '文档',
      };

      let typeBreakdown = '';
      const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
      if (typeEntries.length > 0) {
        typeBreakdown = '\n各类型统计：\n';
        for (const [type, count] of typeEntries) {
          const label = typeLabels[type] || type;
          typeBreakdown += `  - ${label}：${count} 条\n`;
        }
      }

      return `应用统计：\n━━━━━━━━━━━━━━━━━━━━\n活跃创意：${activeCount} 条\n回收站：${trashedCount} 条\n画板：${boards.length} 个\n标签：${tags.length} 个\n创意关联：${links.length} 条${typeBreakdown}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取应用统计失败:', err.message);
    return `获取应用统计失败: ${err.message}`;
  }
}

/**
 * 获取最近编辑的创意
 */
function handleGetRecentEdits(args) {
  try {
    const { limit = 10 } = args;
    const limitNum = Math.max(1, Math.min(50, limit));

    if (repo.db) {
      const rows = repo.db.prepare(
        "SELECT * FROM creativities WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?"
      ).all(limitNum);

      const items = repo.mapRows ? repo.mapRows(rows) : rows;

      if (items.length === 0) {
        return '暂无创意记录';
      }

      const formatted = items.map((item, i) => {
        const typeLabel = item.type === 'text' ? '文本' :
          item.type === 'image' ? '图片' :
          item.type === 'audio' ? '音频' :
          item.type === 'video' ? '视频' :
          item.type === 'document' ? '文档' : item.type;
        const updatedDate = (item.updatedAt || '').substring(0, 19).replace('T', ' ');
        const contentPreview = (item.content || '').substring(0, 60);
        return `${i + 1}. [${typeLabel}] ${item.title}\n   更新于：${updatedDate}\n   ${contentPreview}${(item.content || '').length > 60 ? '...' : ''}`;
      }).join('\n\n');

      return `最近编辑的 ${items.length} 条创意：\n\n${formatted}`;
    } else {
      const creativities = (repo.JsonStore.get('creativities') || [])
        .filter(c => c.status === 'active')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limitNum);

      if (creativities.length === 0) {
        return '暂无创意记录';
      }

      const formatted = creativities.map((item, i) => {
        const updatedDate = (item.updatedAt || '').substring(0, 19).replace('T', ' ');
        const contentPreview = (item.content || '').substring(0, 60);
        return `${i + 1}. [${item.type}] ${item.title}\n   更新于：${updatedDate}\n   ${contentPreview}${(item.content || '').length > 60 ? '...' : ''}`;
      }).join('\n\n');

      return `最近编辑的 ${creativities.length} 条创意：\n\n${formatted}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取最近编辑失败:', err.message);
    return `获取最近编辑失败: ${err.message}`;
  }
}

// ---- 新增工具实现：UI 交互 ----

/**
 * 导航到指定页面
 */
function handleNavigateToPage(args) {
  try {
    const { page, params } = args;

    const validPages = ['home', 'board', 'search', 'favorites', 'trash', 'templates', 'stats', 'settings'];
    const pageLabels = {
      home: '首页',
      board: '画板',
      search: '搜索',
      favorites: '收藏',
      trash: '回收站',
      templates: '模板',
      stats: '统计',
      settings: '设置',
    };

    if (!page || !validPages.includes(page)) {
      return `无效的页面名称：${page}。支持的页面：${validPages.join(', ')}`;
    }

    const label = pageLabels[page] || page;
    let paramInfo = '';
    if (params && typeof params === 'object' && Object.keys(params).length > 0) {
      paramInfo = `，参数：${JSON.stringify(params)}`;
    }

    // 后续将通过 IPC 发送导航事件到渲染进程
    return `导航指令已发送：${label}${paramInfo}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 导航失败:', err.message);
    return `导航失败: ${err.message}`;
  }
}

/**
 * 获取当前 UI 上下文
 */
function handleGetCurrentContext() {
  try {
    // 后续将由 ui-context 服务实现，当前返回占位信息
    return '当前上下文信息（占位）：\n━━━━━━━━━━━━━━━━━━━━\n当前页面：未知\n选中创意：无\n当前画板：无\n\n注：完整的上下文信息将由 ui-context 服务提供，待后续实现。';
  } catch (err: any) {
    console.error('[ToolExecutor] 获取上下文失败:', err.message);
    return `获取上下文失败: ${err.message}`;
  }
}

/**
 * 显示桌面通知
 */
function handleShowNotification(args) {
  try {
    const { title, body } = args;

    if (!title || !title.trim()) {
      return '通知标题不能为空';
    }
    if (!body || !body.trim()) {
      return '通知内容不能为空';
    }

    // 后续将通过 IPC 发送通知事件到渲染进程
    return `通知指令已发送：${title}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 显示通知失败:', err.message);
    return `显示通知失败: ${err.message}`;
  }
}

/**
 * 在默认浏览器中打开 URL
 */
function handleOpenExternalUrl(args) {
  try {
    const { url } = args;

    if (!url || !url.trim()) {
      return 'URL 不能为空';
    }

    // 简单验证 URL 格式
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(url.trim())) {
      return `URL 格式无效：${url}，请提供完整的 URL（以 http:// 或 https:// 开头）`;
    }

    // 后续将通过 IPC 发送打开 URL 事件到渲染进程
    return `打开链接指令已发送：${url}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 打开链接失败:', err.message);
    return `打开链接失败: ${err.message}`;
  }
}

/**
 * 更新软件设置
 */
function handleUpdateSettings(args) {
  try {
    const { key, value } = args;

    if (!key || !key.trim()) {
      return '设置项键名不能为空';
    }

    const validSettings = [
      'ttsVoice', 'ttsRate', 'ttsPitch', 'ttsVolume',
      'soundEnabled', 'soundVolume', 'keyPressSoundEnabled',
      'theme', 'aiEnabled', 'aiProvider', 'aiModel'
    ];

    if (!validSettings.includes(key)) {
      return `无效的设置项：${key}。支持的设置项：${validSettings.join(', ')}`;
    }

    // 通过 IPC 发送设置更新事件到渲染进程
    const { ipcMain } = require('electron');
    const { getMainWindow } = require('../ipc/window');
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:update', { key, value });
    }

    return `设置已更新：${key} = ${JSON.stringify(value)}`;
  } catch (err: any) {
    console.error('[ToolExecutor] 更新设置失败:', err.message);
    return `更新设置失败: ${err.message}`;
  }
}

/**
 * 更换 TTS 音色
 */
function handleChangeTTSVoice(args) {
  try {
    const { voiceType } = args;

    if (!voiceType) {
      return '请指定音色类型';
    }

    // 音色映射表
    const voiceMap = {
      '御姐': 'zh-CN-XiaoxuanNeural',
      '萝莉': 'zh-CN-XiaoyiNeural',
      '温柔女声': 'zh-CN-XiaoxiaoNeural',
      '成熟女声': 'zh-CN-YunxiaNeural',
      '男声': 'zh-CN-YunxiNeural',
      '成熟男声': 'zh-CN-YunjianNeural',
      '温柔男声': 'zh-CN-YunyangNeural',
      '默认': 'zh-CN-XiaoxiaoNeural',
    };

    const voiceKey = voiceMap[voiceType];
    if (!voiceKey) {
      return `不支持的音色类型：${voiceType}。支持的类型：${Object.keys(voiceMap).join('、')}`;
    }

    // 调用 update_settings 更新音色
    return handleUpdateSettings({ key: 'ttsVoice', value: voiceKey });
  } catch (err: any) {
    console.error('[ToolExecutor] 更换音色失败:', err.message);
    return `更换音色失败: ${err.message}`;
  }
}

/**
 * 创建写作台章节
 */
function handleCreateWritingChapter(args) {
  try {
    const { title, content, chapterNumber, wordCount } = args;

    if (!title || !title.trim()) {
      return '章节标题不能为空';
    }
    if (!content || !content.trim()) {
      return '章节内容不能为空';
    }

    // 创建章节创意卡片
    const creativity = {
      id: repo.generateId(),
      title: title.trim(),
      content: content.trim(),
      type: 'text',
      subtype: 'chapter',
      priority: 0,
      emojiReaction: null,
      status: 'active',
      templateId: null,
      boardId: null,
      positionX: null,
      positionY: null,
      cardStyle: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastReviewedAt: null,
      isRead: false,
      isFavorite: false,
      contentFormat: 'markdown',
      wordCount: content.length,
      tags: [],
      // 章节特有字段
      chapterNumber: chapterNumber || null,
      targetWordCount: wordCount || null,
    };

    if (repo.db) {
      const stmt = repo.db.prepare(`
        INSERT INTO creativities (
          id, title, content, type, subtype, priority, emoji_reaction, status,
          template_id, board_id, position_x, position_y, card_style,
          created_at, updated_at, last_reviewed_at, is_read, is_favorite,
          content_format, word_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        creativity.id,
        creativity.title,
        creativity.content,
        creativity.type,
        creativity.subtype,
        creativity.priority,
        creativity.emojiReaction,
        creativity.status,
        creativity.templateId,
        creativity.boardId,
        creativity.positionX,
        creativity.positionY,
        creativity.cardStyle,
        creativity.createdAt,
        creativity.updatedAt,
        creativity.lastReviewedAt,
        creativity.isRead ? 1 : 0,
        creativity.isFavorite ? 1 : 0,
        creativity.contentFormat,
        creativity.wordCount
      );
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      creativities.push(creativity);
      repo.JsonStore.save();
    }

    // 通过 IPC 通知前端刷新
    const { ipcMain } = require('electron');
    const { getMainWindow } = require('../ipc/window');
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('creativity:created', creativity);
    }

    const chapterInfo = chapterNumber ? `第${chapterNumber}章 ` : '';
    return `✅ 章节创建成功！\n\n标题：${chapterInfo}${title}\n字数：${content.length} 字\n已保存到写作台`;
  } catch (err: any) {
    console.error('[ToolExecutor] 创建章节失败:', err.message);
    return `创建章节失败: ${err.message}`;
  }
}

// ============================================================
// P0 - 创意管理补齐实现
// ============================================================

/**
 * 收藏/取消收藏创意
 */
function handleToggleFavorite(args) {
  try {
    const { creativityId } = args;
    if (!creativityId) return '创意ID不能为空';
    if (repo.db) {
      const item = repo.db.prepare("SELECT is_favorite, title FROM creativities WHERE id = ?").get(creativityId);
      if (!item) return `未找到ID为"${creativityId}"的创意`;
      const newFav = item.isFavorite ? 0 : 1;
      repo.db.prepare("UPDATE creativities SET is_favorite = ?, updated_at = ? WHERE id = ?").run(newFav, new Date().toISOString(), creativityId);
      return newFav ? `已收藏创意"${item.title}"` : `已取消收藏"${item.title}"`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const item = creativities.find(c => c.id === creativityId);
      if (!item) return `未找到ID为"${creativityId}"的创意`;
      item.isFavorite = !item.isFavorite;
      item.updatedAt = new Date().toISOString();
      repo.JsonStore.save();
      return item.isFavorite ? `已收藏创意"${item.title}"` : `已取消收藏"${item.title}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 收藏操作失败:', err.message);
    return `操作失败: ${err.message}`;
  }
}

/**
 * 恢复已删除创意
 */
function handleRestoreCreativity(args) {
  try {
    const { creativityId } = args;
    if (!creativityId) return '创意ID不能为空';
    if (repo.db) {
      const item = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!item) return `未找到ID为"${creativityId}"的创意`;
      if (item.status !== 'trashed') return `创意"${item.title}"不在回收站中`;
      repo.db.prepare("UPDATE creativities SET status = 'active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), creativityId);
      // 同时尝试从 trash_items 表中删除记录
      try { repo.db.prepare("DELETE FROM trash_items WHERE item_id = ? AND item_type = 'creativity'").run(creativityId); } catch (_) {}
      return `已恢复创意"${item.title}"`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const item = creativities.find(c => c.id === creativityId);
      if (!item) return `未找到ID为"${creativityId}"的创意`;
      if (item.status !== 'trashed') return `创意"${item.title}"不在回收站中`;
      item.status = 'active';
      item.updatedAt = new Date().toISOString();
      repo.JsonStore.save();
      return `已恢复创意"${item.title}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 恢复创意失败:', err.message);
    return `恢复失败: ${err.message}`;
  }
}

/**
 * 永久删除创意
 */
function handlePermanentDeleteCreativity(args) {
  try {
    const { creativityId } = args;
    if (!creativityId) return '创意ID不能为空';
    if (repo.db) {
      const item = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!item) return `未找到ID为"${creativityId}"的创意`;
      const title = item.title;
      // 删除关联数据
      repo.db.prepare("DELETE FROM creativity_tags WHERE creativity_id = ?").run(creativityId);
      repo.db.prepare("DELETE FROM creativity_links WHERE source_id = ? OR target_id = ?").run(creativityId, creativityId);
      repo.db.prepare("DELETE FROM board_canvas_items WHERE creativity_id = ?").run(creativityId);
      repo.db.prepare("DELETE FROM board_creativities WHERE creativity_id = ?").run(creativityId);
      repo.db.prepare("DELETE FROM board_folder_items WHERE creativity_id = ?").run(creativityId);
      repo.db.prepare("DELETE FROM trash_items WHERE item_id = ? AND item_type = 'creativity'").run(creativityId);
      repo.db.prepare("DELETE FROM creativities WHERE id = ?").run(creativityId);
      return `已永久删除创意"${title}"`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const index = creativities.findIndex(c => c.id === creativityId);
      if (index === -1) return `未找到ID为"${creativityId}"的创意`;
      const title = creativities[index].title;
      creativities.splice(index, 1);
      repo.JsonStore.save();
      return `已永久删除创意"${title}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 永久删除创意失败:', err.message);
    return `永久删除失败: ${err.message}`;
  }
}

/**
 * 批量删除创意
 */
function handleBatchDeleteCreativities(args) {
  try {
    const { ids } = args;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return '请提供要删除的创意ID列表';
    const results = [];
    for (const id of ids) {
      const result = handleDeleteCreativity({ id });
      results.push(result);
    }
    const successCount = results.filter(r => !r.includes('失败') && !r.includes('未找到') && !r.includes('已经在')).length;
    return `批量删除完成：共 ${ids.length} 条，成功 ${successCount} 条`;
  } catch (err: any) {
    console.error('[ToolExecutor] 批量删除失败:', err.message);
    return `批量删除失败: ${err.message}`;
  }
}

/**
 * 随机获取创意
 * 排除写作台章节（subtype = 'chapter'），这些不应作为灵感展示
 */
function handleGetRandomCreativity() {
  try {
    if (repo.db) {
      // 排除写作台章节（subtype = 'chapter'）
      const item = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active' AND (subtype IS NULL OR subtype != 'chapter') ORDER BY RANDOM() LIMIT 1").get();
      if (!item) return '创意库为空，暂无创意';
      return `随机创意灵感：\n标题：${item.title}\n内容：${item.content ? item.content.substring(0, 200) : '（无内容）'}\n类型：${item.type || 'text'}\n创建时间：${item.createdAt}`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      // 排除写作台章节（subtype = 'chapter'）
      const active = creativities.filter(c => c.status === 'active' && c.subtype !== 'chapter');
      if (active.length === 0) return '创意库为空，暂无创意';
      const item = active[Math.floor(Math.random() * active.length)];
      return `随机创意灵感：\n标题：${item.title}\n内容：${item.content ? item.content.substring(0, 200) : '（无内容）'}\n类型：${item.type || 'text'}\n创建时间：${item.createdAt}`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取随机创意失败:', err.message);
    return `获取失败: ${err.message}`;
  }
}

/**
 * 获取创意统计
 */
function handleGetCreativityStats() {
  try {
    if (repo.db) {
      const total = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status != 'trashed'").get().count;
      const trashed = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'trashed'").get().count;
      const favorites = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE is_favorite = 1 AND status != 'trashed'").get().count;
      const typeStats = repo.db.prepare("SELECT type, COUNT(*) as count FROM creativities WHERE status != 'trashed' GROUP BY type").all();
      const subtypeStats = repo.db.prepare("SELECT subtype, COUNT(*) as count FROM creativities WHERE status != 'trashed' AND subtype IS NOT NULL GROUP BY subtype").all();
      const boardCount = repo.db.prepare("SELECT COUNT(*) as count FROM boards").get().count;
      const tagCount = repo.db.prepare("SELECT COUNT(*) as count FROM tags").get().count;

      let result = `创意库统计：\n活跃创意：${total} 条\n回收站：${trashed} 条\n收藏数：${favorites} 条\n看板数：${boardCount} 个\n标签数：${tagCount} 个\n\n按类型分布：`;
      for (const t of typeStats) {
        result += `\n  - ${t.type || '未分类'}: ${t.count} 条`;
      }
      if (subtypeStats.length > 0) {
        result += '\n\n按子类型分布：';
        for (const s of subtypeStats) {
          result += `\n  - ${s.subtype}: ${s.count} 条`;
        }
      }
      return result;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const active = creativities.filter(c => c.status !== 'trashed');
      const trashed = creativities.filter(c => c.status === 'trashed');
      const favorites = active.filter(c => c.isFavorite);
      const boards = repo.JsonStore.get('boards') || [];
      const tags = repo.JsonStore.get('tags') || [];
      const typeMap = {};
      for (const c of active) {
        const t = c.type || 'text';
        typeMap[t] = (typeMap[t] || 0) + 1;
      }
      let result = `创意库统计：\n活跃创意：${active.length} 条\n回收站：${trashed.length} 条\n收藏数：${favorites.length} 条\n看板数：${boards.length} 个\n标签数：${tags.length} 个\n\n按类型分布：`;
      for (const [type, count] of Object.entries(typeMap)) {
        result += `\n  - ${type}: ${count} 条`;
      }
      return result;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 获取统计失败:', err.message);
    return `获取统计失败: ${err.message}`;
  }
}

// ============================================================
// P1 - 看板操作补齐实现
// ============================================================

/**
 * 列出所有看板
 */
function handleListBoards() {
  try {
    if (repo.db) {
      const boards = repo.db.prepare("SELECT * FROM boards ORDER BY sort_order ASC, created_at DESC").all();
      if (boards.length === 0) return '暂无看板';
      let result = `共 ${boards.length} 个看板：\n`;
      for (const b of boards) {
        const count = repo.db.prepare("SELECT COUNT(*) as count FROM board_canvas_items WHERE board_id = ?").get(b.id).count;
        result += `\n- ${b.name} (ID: ${b.id}) - ${b.layout || 'board'} 布局 - ${count} 个创意`;
        if (b.description) result += `\n  描述：${b.description}`;
      }
      return result;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      if (boards.length === 0) return '暂无看板';
      let result = `共 ${boards.length} 个看板：\n`;
      for (const b of boards) {
        result += `\n- ${b.name} (ID: ${b.id}) - ${b.layout || 'board'} 布局`;
        if (b.description) result += `\n  描述：${b.description}`;
      }
      return result;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 列出看板失败:', err.message);
    return `获取看板列表失败: ${err.message}`;
  }
}

/**
 * 更新看板
 */
function handleUpdateBoard(args) {
  try {
    const { boardId, data } = args;
    if (!boardId) return '看板ID不能为空';
    if (!data || typeof data !== 'object') return '更新数据不能为空';
    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const updates = [];
      const values = [];
      if (data.name !== undefined) { updates.push("name = ?"); values.push(data.name); }
      if (data.description !== undefined) { updates.push("description = ?"); values.push(data.description); }
      if (data.layout !== undefined) { updates.push("layout = ?"); values.push(data.layout); }
      if (data.background !== undefined) { updates.push("background = ?"); values.push(data.background); }
      if (data.theme !== undefined) { updates.push("theme = ?"); values.push(data.theme); }
      if (updates.length === 0) return '没有需要更新的字段';
      updates.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(boardId);
      repo.db.prepare(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      return `看板"${board.name}"已更新`;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const board = boards.find(b => b.id === boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      if (data.name !== undefined) board.name = data.name;
      if (data.description !== undefined) board.description = data.description;
      if (data.layout !== undefined) board.layout = data.layout;
      board.updatedAt = new Date().toISOString();
      repo.JsonStore.save();
      return `看板"${board.name}"已更新`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 更新看板失败:', err.message);
    return `更新看板失败: ${err.message}`;
  }
}

/**
 * 删除看板
 */
function handleDeleteBoard(args) {
  try {
    const { boardId } = args;
    if (!boardId) return '看板ID不能为空';
    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const name = board.name;
      // 将看板中的创意移出
      repo.db.prepare("UPDATE creativities SET board_id = NULL, updated_at = ? WHERE board_id = ?").run(new Date().toISOString(), boardId);
      repo.db.prepare("DELETE FROM boards WHERE id = ?").run(boardId);
      return `已删除看板"${name}"，其中的创意已保留在创意库中`;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const index = boards.findIndex(b => b.id === boardId);
      if (index === -1) return `未找到ID为"${boardId}"的看板`;
      const name = boards[index].name;
      boards.splice(index, 1);
      repo.JsonStore.save();
      return `已删除看板"${name}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 删除看板失败:', err.message);
    return `删除看板失败: ${err.message}`;
  }
}

/**
 * 从看板移除创意
 */
function handleRemoveFromBoard(args) {
  try {
    const { boardId, creativityId } = args;
    if (!boardId) return '看板ID不能为空';
    if (!creativityId) return '创意ID不能为空';
    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const creativity = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!creativity) return `未找到ID为"${creativityId}"的创意`;
      // 从画布项中移除
      repo.db.prepare("DELETE FROM board_canvas_items WHERE board_id = ? AND creativity_id = ?").run(boardId, creativityId);
      // 从关联表中移除
      repo.db.prepare("DELETE FROM board_creativities WHERE board_id = ? AND creativity_id = ?").run(boardId, creativityId);
      // 从文件夹关联中移除
      repo.db.prepare("DELETE FROM board_folder_items WHERE creativity_id = ? AND folder_id IN (SELECT id FROM board_custom_folders WHERE board_id = ?)").run(creativityId, boardId);
      // 清除创意的 board_id
      repo.db.prepare("UPDATE creativities SET board_id = NULL, updated_at = ? WHERE id = ? AND board_id = ?").run(new Date().toISOString(), creativityId, boardId);
      return `已将创意"${creativity.title}"从看板"${board.name}"中移除`;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const board = boards.find(b => b.id === boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const creativities = repo.JsonStore.get('creativities') || [];
      const item = creativities.find(c => c.id === creativityId);
      if (!item) return `未找到ID为"${creativityId}"的创意`;
      item.boardId = null;
      item.updatedAt = new Date().toISOString();
      repo.JsonStore.save();
      return `已将创意"${item.title}"从看板"${board.name}"中移除`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 从看板移除创意失败:', err.message);
    return `移除失败: ${err.message}`;
  }
}

/**
 * 列出看板中的创意
 */
function handleListBoardCreativities(args) {
  try {
    const { boardId } = args;
    if (!boardId) return '看板ID不能为空';
    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const items = repo.db.prepare("SELECT * FROM board_canvas_items WHERE board_id = ? ORDER BY created_at DESC").all(boardId);
      if (items.length === 0) return `看板"${board.name}"中暂无创意`;
      let result = `看板"${board.name}"中的创意（共 ${items.length} 个）：\n`;
      for (const item of items) {
        result += `\n- ${item.title || '无标题'} (ID: ${item.creativityId}) - 类型: ${item.type || 'text'}`;
        if (item.content) result += `\n  内容：${item.content.substring(0, 80)}${item.content.length > 80 ? '...' : ''}`;
      }
      return result;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const board = boards.find(b => b.id === boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const creativities = repo.JsonStore.get('creativities') || [];
      const items = creativities.filter(c => c.boardId === boardId);
      if (items.length === 0) return `看板"${board.name}"中暂无创意`;
      let result = `看板"${board.name}"中的创意（共 ${items.length} 个）：\n`;
      for (const item of items) {
        result += `\n- ${item.title} (ID: ${item.id})`;
      }
      return result;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 列出看板创意失败:', err.message);
    return `获取失败: ${err.message}`;
  }
}

/**
 * 创建便签
 */
function handleCreateStickyNote(args) {
  try {
    const { boardId, content, color, positionX, positionY } = args;
    if (!boardId) return '看板ID不能为空';
    if (!content || !content.trim()) return '便签内容不能为空';
    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const noteId = repo.generateId();
      const now = new Date().toISOString();
      repo.db.prepare(
        "INSERT INTO board_sticky_notes (id, board_id, content, color, position_x, position_y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(noteId, boardId, content.trim(), color || '#FFF9C4', positionX || 0, positionY || 0, now, now);
      return `便签已创建！\n看板：${board.name}\n内容：${content.trim().substring(0, 50)}\nID：${noteId}`;
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      const board = boards.find(b => b.id === boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      return '便签功能需要数据库支持';
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 创建便签失败:', err.message);
    return `创建便签失败: ${err.message}`;
  }
}

/**
 * 删除便签
 */
function handleDeleteStickyNote(args) {
  try {
    const { boardId, noteId } = args;
    if (!boardId) return '看板ID不能为空';
    if (!noteId) return '便签ID不能为空';
    if (repo.db) {
      const note = repo.db.prepare("SELECT * FROM board_sticky_notes WHERE id = ? AND board_id = ?").get(noteId, boardId);
      if (!note) return `未找到指定的便签`;
      repo.db.prepare("DELETE FROM board_sticky_notes WHERE id = ?").run(noteId);
      return '便签已删除';
    } else {
      return '便签功能需要数据库支持';
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 删除便签失败:', err.message);
    return `删除便签失败: ${err.message}`;
  }
}

/**
 * 创建看板文件夹
 */
function handleCreateBoardFolder(args) {
  try {
    const { boardId, name } = args;
    if (!boardId) return '看板ID不能为空';
    if (!name || !name.trim()) return '文件夹名称不能为空';
    if (repo.db) {
      const board = repo.db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
      if (!board) return `未找到ID为"${boardId}"的看板`;
      const folderId = repo.generateId();
      repo.db.prepare(
        "INSERT INTO board_custom_folders (id, board_id, name, created_at) VALUES (?, ?, ?, ?)"
      ).run(folderId, boardId, name.trim(), new Date().toISOString());
      return `文件夹已创建！\n看板：${board.name}\n名称：${name.trim()}\nID：${folderId}`;
    } else {
      return '文件夹功能需要数据库支持';
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 创建文件夹失败:', err.message);
    return `创建文件夹失败: ${err.message}`;
  }
}

/**
 * 将创意添加到文件夹
 */
function handleAddToFolder(args) {
  try {
    const { boardId, folderId, creativityId } = args;
    if (!boardId) return '看板ID不能为空';
    if (!folderId) return '文件夹ID不能为空';
    if (!creativityId) return '创意ID不能为空';
    if (repo.db) {
      const folder = repo.db.prepare("SELECT * FROM board_custom_folders WHERE id = ? AND board_id = ?").get(folderId, boardId);
      if (!folder) return `未找到指定的文件夹`;
      const creativity = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!creativity) return `未找到ID为"${creativityId}"的创意`;
      const existing = repo.db.prepare("SELECT * FROM board_folder_items WHERE folder_id = ? AND creativity_id = ?").get(folderId, creativityId);
      if (existing) return `创意"${creativity.title}"已在该文件夹中`;
      repo.db.prepare(
        "INSERT INTO board_folder_items (folder_id, creativity_id) VALUES (?, ?)"
      ).run(folderId, creativityId);
      return `已将创意"${creativity.title}"添加到文件夹"${folder.name}"`;
    } else {
      return '文件夹功能需要数据库支持';
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 添加到文件夹失败:', err.message);
    return `操作失败: ${err.message}`;
  }
}

// ============================================================
// P2 - 标签/模板补齐实现
// ============================================================

/**
 * 删除标签
 */
function handleDeleteTag(args) {
  try {
    const { tagId } = args;
    if (!tagId) return '标签ID不能为空';
    if (repo.db) {
      const tag = repo.db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
      if (!tag) return `未找到ID为"${tagId}"的标签`;
      const name = tag.name;
      // 删除关联
      repo.db.prepare("DELETE FROM creativity_tags WHERE tag_id = ?").run(tagId);
      repo.db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
      return `已删除标签"${name}"`;
    } else {
      const tags = repo.JsonStore.get('tags') || [];
      const index = tags.findIndex(t => t.id === tagId);
      if (index === -1) return `未找到ID为"${tagId}"的标签`;
      const name = tags[index].name;
      tags.splice(index, 1);
      repo.JsonStore.save();
      return `已删除标签"${name}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 删除标签失败:', err.message);
    return `删除标签失败: ${err.message}`;
  }
}

/**
 * 更新标签
 */
function handleUpdateTag(args) {
  try {
    const { tagId, data } = args;
    if (!tagId) return '标签ID不能为空';
    if (!data || typeof data !== 'object') return '更新数据不能为空';
    if (repo.db) {
      const tag = repo.db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
      if (!tag) return `未找到ID为"${tagId}"的标签`;
      const updates = [];
      const values = [];
      if (data.name !== undefined) { updates.push("name = ?"); values.push(data.name); }
      if (data.color !== undefined) { updates.push("color = ?"); values.push(data.color); }
      if (data.icon !== undefined) { updates.push("icon = ?"); values.push(data.icon); }
      if (updates.length === 0) return '没有需要更新的字段';
      values.push(tagId);
      repo.db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      return `标签"${tag.name}"已更新`;
    } else {
      const tags = repo.JsonStore.get('tags') || [];
      const tag = tags.find(t => t.id === tagId);
      if (!tag) return `未找到ID为"${tagId}"的标签`;
      if (data.name !== undefined) tag.name = data.name;
      if (data.color !== undefined) tag.color = data.color;
      if (data.icon !== undefined) tag.icon = data.icon;
      repo.JsonStore.save();
      return `标签"${tag.name}"已更新`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 更新标签失败:', err.message);
    return `更新标签失败: ${err.message}`;
  }
}

/**
 * 列出所有标签
 */
function handleListTags() {
  try {
    if (repo.db) {
      const tags = repo.db.prepare("SELECT * FROM tags ORDER BY created_at DESC").all();
      if (tags.length === 0) return '暂无标签';
      let result = `共 ${tags.length} 个标签：\n`;
      for (const t of tags) {
        const count = repo.db.prepare("SELECT COUNT(*) as count FROM creativity_tags WHERE tag_id = ?").get(t.id).count;
        result += `\n- ${t.name} (ID: ${t.id}) - ${count} 个创意${t.color ? ` - 颜色: ${t.color}` : ''}`;
      }
      return result;
    } else {
      const tags = repo.JsonStore.get('tags') || [];
      if (tags.length === 0) return '暂无标签';
      let result = `共 ${tags.length} 个标签：\n`;
      for (const t of tags) {
        result += `\n- ${t.name} (ID: ${t.id})${t.color ? ` - 颜色: ${t.color}` : ''}`;
      }
      return result;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 列出标签失败:', err.message);
    return `获取标签列表失败: ${err.message}`;
  }
}

/**
 * 应用模板到创意
 */
function handleApplyTemplate(args) {
  try {
    const { templateId, creativityId } = args;
    if (!templateId) return '模板ID不能为空';
    if (!creativityId) return '创意ID不能为空';
    if (repo.db) {
      const template = repo.db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId);
      if (!template) return `未找到ID为"${templateId}"的模板`;
      const creativity = repo.db.prepare("SELECT * FROM creativities WHERE id = ?").get(creativityId);
      if (!creativity) return `未找到ID为"${creativityId}"的创意`;
      // 将模板的 config 内容应用到创意
      let config = {};
      try { config = JSON.parse(template.config || '{}'); } catch (_) {}
      if (config.content && typeof config.content === 'string') {
        repo.db.prepare("UPDATE creativities SET content = ?, template_id = ?, updated_at = ? WHERE id = ?").run(
          config.content, templateId, new Date().toISOString(), creativityId
        );
      } else {
        repo.db.prepare("UPDATE creativities SET template_id = ?, updated_at = ? WHERE id = ?").run(
          templateId, new Date().toISOString(), creativityId
        );
      }
      return `已将模板"${template.name}"应用到创意"${creativity.title}"`;
    } else {
      const templates = repo.JsonStore.get('templates') || [];
      const template = templates.find(t => t.id === templateId);
      if (!template) return `未找到ID为"${templateId}"的模板`;
      const creativities = repo.JsonStore.get('creativities') || [];
      const creativity = creativities.find(c => c.id === creativityId);
      if (!creativity) return `未找到ID为"${creativityId}"的创意`;
      let config = {};
      try { config = JSON.parse(template.config || '{}'); } catch (_) {}
      if (config.content) creativity.content = config.content;
      creativity.templateId = templateId;
      creativity.updatedAt = new Date().toISOString();
      repo.JsonStore.save();
      return `已将模板"${template.name}"应用到创意"${creativity.title}"`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 应用模板失败:', err.message);
    return `应用模板失败: ${err.message}`;
  }
}

// ============================================================
// P3 - 导出/备份/回收站/音乐精细控制实现
// ============================================================

/**
 * 导出创意
 */
function handleExportCreativities(args) {
  try {
    const { format, ids } = args;
    if (!format) return '请指定导出格式（json/html/markdown）';
    const validFormats = ['json', 'html', 'markdown'];
    if (!validFormats.includes(format)) return `不支持的格式：${format}，支持：${validFormats.join(', ')}`;

    if (repo.db) {
      let rows;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        rows = repo.db.prepare(`SELECT * FROM creativities WHERE id IN (${placeholders}) AND status != 'trashed'`).all(...ids);
      } else {
        rows = repo.db.prepare("SELECT * FROM creativities WHERE status != 'trashed' ORDER BY created_at DESC").all();
      }
      if (rows.length === 0) return '没有可导出的创意';

      // 通过 IPC 发送到渲染进程进行实际导出
      const { getMainWindow } = require('../ipc/window');
      const mainWindow = getMainWindow?.();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('export:creativities', { format, ids, count: rows.length });
      }
      return `已准备导出 ${rows.length} 条创意为 ${format.toUpperCase()} 格式，请在弹出的保存对话框中选择保存位置`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      let items = creativities.filter(c => c.status !== 'trashed');
      if (ids && Array.isArray(ids) && ids.length > 0) {
        items = items.filter(c => ids.includes(c.id));
      }
      if (items.length === 0) return '没有可导出的创意';
      return `已准备导出 ${items.length} 条创意为 ${format.toUpperCase()} 格式`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 导出创意失败:', err.message);
    return `导出失败: ${err.message}`;
  }
}

/**
 * 列出回收站
 */
function handleListTrash() {
  try {
    if (repo.db) {
      // 先查 trash_items 表
      const trashItems = repo.db.prepare("SELECT * FROM trash_items ORDER BY deleted_at DESC").all();
      // 再查 status='trashed' 的创意
      const trashedCreativities = repo.db.prepare("SELECT id, title, type, updated_at FROM creativities WHERE status = 'trashed' ORDER BY updated_at DESC").all();

      if (trashItems.length === 0 && trashedCreativities.length === 0) return '回收站为空';

      let result = `回收站内容：\n`;
      if (trashedCreativities.length > 0) {
        result += `\n已删除创意（${trashedCreativities.length} 条）：`;
        for (const c of trashedCreativities) {
          result += `\n- ${c.title} (ID: ${c.id}) - 类型: ${c.type || 'text'}`;
        }
      }
      if (trashItems.length > 0) {
        result += `\n\n回收站记录（${trashItems.length} 条）：`;
        for (const item of trashItems) {
          result += `\n- ${item.itemType} (ID: ${item.itemId}) - 删除时间: ${item.deletedAt}`;
        }
      }
      return result;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const trash = repo.JsonStore.get('trash') || [];
      const trashed = creativities.filter(c => c.status === 'trashed');
      if (trashed.length === 0 && trash.length === 0) return '回收站为空';
      let result = `回收站内容：\n`;
      for (const c of trashed) {
        result += `\n- ${c.title} (ID: ${c.id})`;
      }
      return result;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 列出回收站失败:', err.message);
    return `获取回收站列表失败: ${err.message}`;
  }
}

/**
 * 清空回收站
 */
function handleClearTrash() {
  try {
    if (repo.db) {
      // 获取所有 trashed 状态的创意ID
      const trashedIds = repo.db.prepare("SELECT id FROM creativities WHERE status = 'trashed'").all().map(r => r.id);
      // 删除关联数据
      for (const id of trashedIds) {
        repo.db.prepare("DELETE FROM creativity_tags WHERE creativity_id = ?").run(id);
        repo.db.prepare("DELETE FROM creativity_links WHERE source_id = ? OR target_id = ?").run(id, id);
        repo.db.prepare("DELETE FROM board_canvas_items WHERE creativity_id = ?").run(id);
        repo.db.prepare("DELETE FROM board_creativities WHERE creativity_id = ?").run(id);
        repo.db.prepare("DELETE FROM board_folder_items WHERE creativity_id = ?").run(id);
      }
      // 永久删除
      if (trashedIds.length > 0) {
        const placeholders = trashedIds.map(() => '?').join(',');
        repo.db.prepare(`DELETE FROM creativities WHERE id IN (${placeholders})`).run(...trashedIds);
      }
      // 清空 trash_items 表
      repo.db.prepare("DELETE FROM trash_items").run();
      return `回收站已清空，共永久删除 ${trashedIds.length} 条创意`;
    } else {
      const creativities = repo.JsonStore.get('creativities') || [];
      const before = creativities.length;
      const remaining = creativities.filter(c => c.status !== 'trashed');
      const removed = before - remaining.length;
      repo.JsonStore.set('creativities', remaining);
      repo.JsonStore.set('trash', []);
      repo.JsonStore.save();
      return `回收站已清空，共永久删除 ${removed} 条创意`;
    }
  } catch (err: any) {
    console.error('[ToolExecutor] 清空回收站失败:', err.message);
    return `清空回收站失败: ${err.message}`;
  }
}

/**
 * 高级音乐控制
 */
function handleControlMusicAdvanced(args) {
  try {
    const { action, value } = args;
    const validActions = ['next_track', 'prev_track', 'volume_up', 'volume_down', 'set_volume', 'toggle_play_mode', 'toggle_favorite'];
    if (!validActions.includes(action)) {
      return `无效的动作：${action}。支持的动作：${validActions.join(', ')}`;
    }

    const { getMainWindow } = require('../ipc/window');
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('music:control-advanced', { action, value });
    }

    const actionMessages = {
      next_track: '已切换到下一首',
      prev_track: '已切换到上一首',
      volume_up: '已增大音量',
      volume_down: '已减小音量',
      set_volume: `已设置音量为 ${value || 50}%`,
      toggle_play_mode: '已切换播放模式',
      toggle_favorite: '已切换收藏状态',
    };

    return actionMessages[action] || `已执行 ${action} 操作`;
  } catch (err: any) {
    console.error('[ToolExecutor] 高级音乐控制失败:', err.message);
    return `音乐控制失败: ${err.message}`;
  }
}

// ============================================================
// 天气系统工具实现（直接在主进程获取数据，AI 返回真实结果）
// ============================================================

const WeatherService = require('./weather-service');

/**
 * 获取当前天气 - 返回真实数据
 */
async function handleGetWeather() {
  try {
    const data = await WeatherService.fetchCurrentWeather();
    if (!data) return '抱歉，暂时无法获取天气信息，请稍后再试。';

    const result = [
      `📍 ${data.city}`,
      `🌡️ 当前温度：${data.temperature}°C`,
      `🌤️ 天气状况：${data.weatherLabel}`,
      `💨 风速：${data.windSpeed}km/h`,
      `💧 湿度：${data.humidity}%`,
    ].join('\n');

    // 同时通知渲染进程弹出天气卡片
    WeatherService.notifyRenderer('weather:ai-response', {
      action: 'show_current',
      data,
    });

    return result;
  } catch (err) {
    console.error('[ToolExecutor] 获取天气失败:', err.message);
    return `获取天气失败: ${err.message}`;
  }
}

/**
 * 获取天气预报 - 返回真实数据
 */
async function handleGetWeatherForecast(args: any) {
  try {
    const days = args?.days || 3;
    const result = await WeatherService.fetchForecast(days);
    if (!result) return '抱歉，暂时无法获取天气预报。';

    const dayNames = ['今天', '明天', '后天', '第4天', '第5天', '第6天', '第7天'];
    const lines = [`📍 ${result.city} 未来${days}天预报：\n`];
    result.forecasts.slice(0, days).forEach((f: any, i: number) => {
      lines.push(`${dayNames[i] || f.date}：${f.weatherLabel}，${f.minTemp}°C ~ ${f.maxTemp}°C，降水概率 ${f.precipitationProbability}%`);
    });

    // 通知渲染进程弹出预报卡片
    WeatherService.notifyRenderer('weather:ai-response', {
      action: 'show_forecast',
      data: result,
    });

    return lines.join('\n');
  } catch (err) {
    console.error('[ToolExecutor] 获取天气预报失败:', err.message);
    return `获取天气预报失败: ${err.message}`;
  }
}

/**
 * 获取天气预警 - 返回真实数据
 */
async function handleGetWeatherAlerts() {
  try {
    const result = await WeatherService.fetchWeatherAlerts();
    if (!result || result.alerts.length === 0) {
      return `📍 ${result?.city || '当前城市'}：当前没有天气预警，天气状况良好。`;
    }

    const lines = [`📍 ${result.city} 天气预警（共${result.alerts.length}条）：\n`];
    result.alerts.forEach((a: any, i: number) => {
      const levelText = { extreme: '🔴 极端', high: '🟠 高危', medium: '🟡 中等', low: '🔵 一般' };
      lines.push(`${i + 1}. ${levelText[a.level] || ''} ${a.title}`);
      lines.push(`   ${a.message}`);
      if (a.advice?.[0]) lines.push(`   💡 ${a.advice[0]}`);
    });

    // 通知渲染进程弹出预警通知
    WeatherService.notifyRenderer('weather:ai-response', {
      action: 'show_alerts',
      data: result,
    });

    return lines.join('\n');
  } catch (err) {
    console.error('[ToolExecutor] 获取天气预警失败:', err.message);
    return `获取天气预警失败: ${err.message}`;
  }
}

/**
 * 切换天气预警开关
 */
async function handleToggleWeatherAlerts(args: any) {
  try {
    const { enabled } = args;
    // 通知渲染进程更新设置
    WeatherService.notifyRenderer('weather:toggle-alerts', { enabled });
    return `天气预警已${enabled ? '开启' : '关闭'}。${enabled ? '系统将实时监测天气异常并推送预警通知。' : '天气预警已关闭，不会再收到预警通知。'}`;
  } catch (err) {
    return `切换天气预警失败: ${err.message}`;
  }
}

/**
 * 设置天气播报时间
 */
async function handleSetWeatherBriefingTime(args: any) {
  try {
    const { type, time } = args;
    if (!type || !time) return '请指定播报类型（morning/evening）和时间（如 08:00）';
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(time)) return '时间格式不正确，请使用 HH:MM 格式，如 08:00';
    
    WeatherService.notifyRenderer('weather:set-briefing-time', { type, time });
    return `已设置${type === 'morning' ? '早上' : '晚上'}天气播报时间为 ${time}。`;
  } catch (err) {
    return `设置播报时间失败: ${err.message}`;
  }
}

/**
 * 显示每日天气播报 - 返回真实播报内容
 */
async function handleShowDailyWeatherBriefing() {
  try {
    const hour = new Date().getHours();
    const type: 'morning' | 'evening' = hour >= 12 ? 'evening' : 'morning';
    const briefing = await WeatherService.fetchDailyBriefing(type);
    if (!briefing) return '抱歉，暂时无法获取天气播报。';

    const lines = [
      `${briefing.greeting} 📍 ${briefing.city}`,
      '',
      `📅 今日天气：${briefing.today}`,
    ];
    if (briefing.tomorrow) lines.push(`📅 明日天气：${briefing.tomorrow}`);
    lines.push(`\n👕 穿衣建议：${briefing.outfitAdvice}`);
    lines.push(`🏃 活动建议：${briefing.activityAdvice}`);
    lines.push(`💊 健康建议：${briefing.healthAdvice}`);
    if (briefing.alerts.length > 0) {
      lines.push(`\n⚠️ 天气预警：`);
      briefing.alerts.forEach((a: any) => lines.push(`  - ${a.title}：${a.message}`));
    }

    // 通知渲染进程弹出播报卡片
    WeatherService.notifyRenderer('weather:ai-response', {
      action: 'show_briefing',
      data: briefing,
    });

    return lines.join('\n');
  } catch (err) {
    console.error('[ToolExecutor] 显示天气播报失败:', err.message);
    return `显示天气播报失败: ${err.message}`;
  }
}

/**
 * 设置天气定位模式
 */
async function handleSetWeatherLocationMode(args: any) {
  try {
    const { mode } = args;
    if (!mode || !['auto', 'manual'].includes(mode)) {
      return '请指定有效的定位模式：auto（自动定位）或 manual（手动选择）';
    }

    // 清除城市缓存
    WeatherService.clearCityCache();

    // 通知渲染进程切换模式
    WeatherService.notifyRenderer('weather:set-location-mode', { mode });

    const modeText = mode === 'auto' ? '自动定位' : '手动选择';
    return `已切换天气定位模式为：${modeText}。${mode === 'auto' ? '系统将尝试自动获取您的位置。' : '已打开城市选择器，请选择您所在的城市。'}`;
  } catch (err) {
    return `设置定位模式失败: ${err.message}`;
  }
}

/**
 * 打开城市选择器
 */
async function handleOpenCitySelector() {
  try {
    WeatherService.notifyRenderer('weather:open-city-selector');
    return '已打开城市选择器，请在弹出的窗口中选择您所在的城市。';
  } catch (err) {
    return `打开城市选择器失败: ${err.message}`;
  }
}

/**
 * 获取当前天气定位信息
 */
async function handleGetCurrentWeatherLocation() {
  try {
    const city = await WeatherService['getCurrentCityCoords'] 
      ? (WeatherService as any).getCurrentCityCoords() 
      : null;
    
    // 同时通过渲染进程获取模式信息
    WeatherService.notifyRenderer('weather:get-location-info');
    
    if (city) {
      return `当前天气定位城市：${city.name}（纬度 ${city.latitude}，经度 ${city.longitude}）`;
    }
    return '正在获取当前天气定位信息...';
  } catch (err) {
    return `获取定位信息失败: ${err.message}`;
  }
}

/**
 * 即时触发天气预报通知（新增）
 */
async function handleTriggerForecastNotification() {
  try {
    const result = await WeatherService.fetchForecast(2);
    if (!result || result.forecasts.length < 2) return '无法获取天气预报数据。';

    const tomorrow = result.forecasts[1];

    // 通知渲染进程弹出预报通知卡片
    WeatherService.notifyRenderer('weather:ai-response', {
      action: 'trigger_forecast_notification',
      data: { city: result.city, tomorrow },
    });

    return `已触发明日天气预报通知：${result.city}明天${tomorrow.weatherLabel}，${tomorrow.minTemp}°C ~ ${tomorrow.maxTemp}°C。`;
  } catch (err) {
    return `触发预报通知失败: ${err.message}`;
  }
}

/**
 * 即时触发天气预警通知（新增）
 */
async function handleTriggerAlertNotification() {
  try {
    const result = await WeatherService.fetchWeatherAlerts();
    if (!result || result.alerts.length === 0) {
      return '当前没有天气预警，天气状况良好。';
    }

    // 通知渲染进程弹出预警通知卡片
    WeatherService.notifyRenderer('weather:ai-response', {
      action: 'trigger_alert_notification',
      data: result,
    });

    return `已触发天气预警通知：检测到 ${result.alerts.length} 条预警。`;
  } catch (err) {
    return `触发预警通知失败: ${err.message}`;
  }
}

// ============================================================
// 对标 Trae SOLO 五大工具能力 - 处理器实现
// ============================================================

// ---- 1. 阅读：对创意进行检索和查看 ----

async function handleReadCreativities(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { ids, query, limit = 10, includeContent = true } = args;
    let rows: any[] = [];

    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      rows = db.prepare(`SELECT * FROM creativities WHERE id IN (${placeholders}) AND status = 'active'`).all(...ids);
    } else if (query) {
      const likeQuery = `%${query}%`;
      rows = db.prepare(
        "SELECT * FROM creativities WHERE status = 'active' AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT ?"
      ).all(likeQuery, likeQuery, limit);
    } else {
      rows = db.prepare("SELECT * FROM creativities WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?").all(limit);
    }

    if (rows.length === 0) return '未找到匹配的创意';

    const results = rows.map(row => {
      const item = repo.toCamelCase(row);
      const result: any = {
        id: item.id,
        title: item.title,
        type: item.type || 'text',
        subtype: item.subtype || '',
        tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) : [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      if (includeContent) {
        result.content = item.content || '';
        result.wordCount = (item.content || '').length;
      } else {
        result.contentPreview = (item.content || '').substring(0, 100) + ((item.content || '').length > 100 ? '...' : '');
      }
      return result;
    });

    return `找到 ${results.length} 条创意：\n${JSON.stringify(results, null, 2)}`;
  } catch (err: any) {
    return `阅读创意失败: ${err.message}`;
  }
}

async function handleReadCreativityFull(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { id, includeRelated = true } = args;
    const row = db.prepare("SELECT * FROM creativities WHERE id = ? AND status = 'active'").get(id);
    if (!row) return `未找到 ID 为 "${id}" 的创意`;

    const item = repo.toCamelCase(row);
    const result: any = {
      id: item.id,
      title: item.title,
      content: item.content || '',
      type: item.type || 'text',
      subtype: item.subtype || '',
      tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) : [],
      wordCount: (item.content || '').length,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    if (includeRelated) {
      const boards = db.prepare(`
        SELECT b.id, b.title FROM boards b
        JOIN board_items bi ON b.id = bi.board_id
        WHERE bi.creativity_id = ?
      `).all(id);
      result.boards = boards.map((b: any) => repo.toCamelCase(b));

      const sameTypeRows = db.prepare(
        "SELECT id, title FROM creativities WHERE type = ? AND id != ? AND status = 'active' LIMIT 5"
      ).all(item.type, id);
      result.relatedByType = sameTypeRows.map((r: any) => repo.toCamelCase(r));
    }

    return `创意详情：\n${JSON.stringify(result, null, 2)}`;
  } catch (err: any) {
    return `深度阅读创意失败: ${err.message}`;
  }
}

async function handleScanCreativityLibrary(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { includeRecent = true, includeTagCloud = true, recentLimit = 5 } = args;

    const total = db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active'").get().count;
    const trashed = db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'trashed'").get().count;

    const typeRows = db.prepare("SELECT type, COUNT(*) as count FROM creativities WHERE status = 'active' GROUP BY type").all();
    const typeDistribution: any = {};
    for (const row of typeRows) typeDistribution[row.type || 'text'] = row.count;

    const result: any = {
      total,
      trashed,
      typeDistribution,
    };

    if (includeRecent) {
      const recentRows = db.prepare(
        "SELECT id, title, type, updated_at FROM creativities WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?"
      ).all(recentLimit);
      result.recentCreativities = recentRows.map((r: any) => repo.toCamelCase(r));
    }

    if (includeTagCloud) {
      const tagRows = db.prepare("SELECT tags FROM creativities WHERE status = 'active' AND tags IS NOT NULL AND tags != ''").all();
      const tagCount: any = {};
      for (const row of tagRows) {
        try {
          const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              tagCount[tag] = (tagCount[tag] || 0) + 1;
            }
          }
        } catch { /* ignore */ }
      }
      result.tagCloud = Object.entries(tagCount)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 20)
        .map(([tag, count]) => ({ tag, count }));
    }

    const boardCount = db.prepare("SELECT COUNT(*) as count FROM boards").get().count;
    result.boardCount = boardCount;

    return `创意库概览：\n${JSON.stringify(result, null, 2)}`;
  } catch (err: any) {
    return `扫描创意库失败: ${err.message}`;
  }
}

// ---- 2. 编辑：对创意进行增删和编辑 ----

async function handleBatchCreateCreativities(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { items, boardId } = args;
    if (!items || !Array.isArray(items) || items.length === 0) return '请提供要创建的创意列表';

    const now = new Date().toISOString();
    const created: any[] = [];
    const insertStmt = db.prepare(`
      INSERT INTO creativities (id, title, content, type, subtype, tags, status, word_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    const insertMany = db.transaction((list: any[]) => {
      for (const item of list) {
        const id = generateId();
        const content = item.content || '';
        const tags = item.tags ? JSON.stringify(item.tags) : '[]';
        insertStmt.run(id, item.title.trim(), content.trim(), item.type || 'text', item.subtype || '', tags, content.length, now, now);
        created.push({ id, title: item.title.trim() });
      }
    });

    insertMany(items);

    if (boardId && created.length > 0) {
      const boardInsert = db.prepare('INSERT OR IGNORE INTO board_items (board_id, creativity_id, added_at) VALUES (?, ?, ?)');
      const addMany = db.transaction((list: any[]) => {
        for (const item of list) {
          boardInsert.run(boardId, item.id, now);
        }
      });
      addMany(created);
    }

    notifyCreativityChange();
    return `批量创建成功！共创建 ${created.length} 条创意：\n${created.map((c, i) => `${i + 1}. ${c.title} (ID: ${c.id})`).join('\n')}`;
  } catch (err: any) {
    return `批量创建创意失败: ${err.message}`;
  }
}

async function handleSmartEditCreativity(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { id, mode, content, mergeIds, rewriteStyle } = args;
    const row = db.prepare("SELECT * FROM creativities WHERE id = ? AND status = 'active'").get(id);
    if (!row) return `未找到 ID 为 "${id}" 的创意`;

    const item = repo.toCamelCase(row);
    const now = new Date().toISOString();
    let newContent = item.content || '';
    let newTitle = item.title;

    switch (mode) {
      case 'append':
        if (!content) return 'append 模式需要提供 content 参数';
        newContent = newContent + '\n\n' + content;
        break;
      case 'prepend':
        if (!content) return 'prepend 模式需要提供 content 参数';
        newContent = content + '\n\n' + newContent;
        break;
      case 'replace':
        if (!content) return 'replace 模式需要提供 content 参数';
        newContent = content;
        break;
      case 'rewrite': {
        const styleMap: any = {
          formal: '正式、专业的风格',
          casual: '轻松、口语化的风格',
          creative: '富有创意和想象力的风格',
          concise: '精简、凝练的风格',
          expand: '扩展、丰富的风格',
        };
        const styleDesc = styleMap[rewriteStyle] || '保持原有风格';
        const { chat } = require('./ai-service');
        const aiConfig = currentAIConfig || { provider: 'openai', model: 'gpt-4o-mini' };
        const rewriteResult = await chat(aiConfig, [
          { role: 'system', content: `你是一位专业的文字编辑。请用${styleDesc}改写以下内容，保持核心意思不变。直接输出改写后的内容，不要加任何前缀说明。` },
          { role: 'user', content: newContent },
        ]);
        newContent = rewriteResult;
        break;
      }
      case 'merge': {
        if (!mergeIds || mergeIds.length === 0) return 'merge 模式需要提供 mergeIds 参数';
        const mergeRows = db.prepare(`SELECT * FROM creativities WHERE id IN (${mergeIds.map(() => '?').join(',')}) AND status = 'active'`).all(...mergeIds);
        if (mergeRows.length === 0) return '未找到要合并的创意';
        const mergeContents = [newContent];
        for (const mr of mergeRows) {
          const mi = repo.toCamelCase(mr);
          mergeContents.push(`--- ${mi.title} ---\n${mi.content || ''}`);
        }
        const { chat } = require('./ai-service');
        const aiConfig = currentAIConfig || { provider: 'openai', model: 'gpt-4o-mini' };
        const mergeResult = await chat(aiConfig, [
          { role: 'system', content: '你是一位专业的内容整合专家。请将以下多条创意内容合并为一条完整、连贯的内容。保留所有重要信息，去除重复，使结构清晰。直接输出合并后的内容。' },
          { role: 'user', content: mergeContents.join('\n\n') },
        ]);
        newContent = mergeResult;
        const mergedTitles = [item.title, ...mergeRows.map((mr: any) => repo.toCamelCase(mr).title)].join(' + ');
        newTitle = mergedTitles.length > 50 ? mergedTitles.substring(0, 47) + '...' : mergedTitles;
        break;
      }
      default:
        return `不支持的编辑模式: ${mode}`;
    }

    db.prepare('UPDATE creativities SET content = ?, title = ?, word_count = ?, updated_at = ? WHERE id = ?')
      .run(newContent, newTitle, newContent.length, now, id);

    notifyCreativityChange();
    return `创意已${mode === 'append' ? '追加' : mode === 'prepend' ? '前置' : mode === 'replace' ? '替换' : mode === 'rewrite' ? '改写' : '合并'}成功！\n标题：${newTitle}\n当前字数：${newContent.length}`;
  } catch (err: any) {
    return `智能编辑创意失败: ${err.message}`;
  }
}

async function handleOrganizeCreativities(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { action, ids, boardId, tags, newType, newSubtype } = args;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return '请提供要整理的创意ID列表';

    const now = new Date().toISOString();
    let affected = 0;

    switch (action) {
      case 'move_to_board': {
        if (!boardId) return 'move_to_board 操作需要提供 boardId';
        const board = db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
        if (!board) return `未找到画板 "${boardId}"`;
        const insertStmt = db.prepare('INSERT OR IGNORE INTO board_items (board_id, creativity_id, added_at) VALUES (?, ?, ?)');
        const moveMany = db.transaction((list: string[]) => {
          for (const cid of list) {
            insertStmt.run(boardId, cid, now);
            affected++;
          }
        });
        moveMany(ids);
        break;
      }
      case 'add_tags': {
        if (!tags || tags.length === 0) return 'add_tags 操作需要提供 tags';
        for (const cid of ids) {
          const row = db.prepare('SELECT tags FROM creativities WHERE id = ?').get(cid);
          if (!row) continue;
          let existingTags: string[] = [];
          try { existingTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []); } catch { existingTags = []; }
          const merged = [...new Set([...existingTags, ...tags])];
          db.prepare('UPDATE creativities SET tags = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(merged), now, cid);
          affected++;
        }
        break;
      }
      case 'remove_tags': {
        if (!tags || tags.length === 0) return 'remove_tags 操作需要提供 tags';
        for (const cid of ids) {
          const row = db.prepare('SELECT tags FROM creativities WHERE id = ?').get(cid);
          if (!row) continue;
          let existingTags: string[] = [];
          try { existingTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []); } catch { existingTags = []; }
          const filtered = existingTags.filter((t: string) => !tags.includes(t));
          db.prepare('UPDATE creativities SET tags = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(filtered), now, cid);
          affected++;
        }
        break;
      }
      case 'change_type': {
        if (!newType) return 'change_type 操作需要提供 newType';
        db.prepare(`UPDATE creativities SET type = ?, updated_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`).run(newType, now, ...ids);
        affected = ids.length;
        break;
      }
      case 'change_subtype': {
        if (!newSubtype) return 'change_subtype 操作需要提供 newSubtype';
        db.prepare(`UPDATE creativities SET subtype = ?, updated_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`).run(newSubtype, now, ...ids);
        affected = ids.length;
        break;
      }
      default:
        return `不支持的整理操作: ${action}`;
    }

    notifyCreativityChange();
    return `整理完成！操作：${action}，影响 ${affected} 条创意`;
  } catch (err: any) {
    return `整理创意失败: ${err.message}`;
  }
}

// ---- 3. 终端：执行代码和脚本 ----

async function handleRunScript(args: any) {
  try {
    const { command, args: cmdArgs = [], cwd, timeout = 30000 } = args;
    if (!command) return '请提供要执行的命令';

    const { execFile } = require('child_process');
    const result = await new Promise<string>((resolve, reject) => {
      const proc = execFile(command, cmdArgs, {
        cwd: cwd || undefined,
        timeout,
        maxBuffer: 1024 * 1024,
      }, (err: any, stdout: string, stderr: string) => {
        if (err) {
          resolve(`执行失败 (退出码 ${err.code || 'N/A'})\n${stderr || err.message}`);
        } else {
          resolve(stdout || '(无输出)');
        }
      });
    });

    return `执行结果：\n${result}`;
  } catch (err: any) {
    return `执行脚本失败: ${err.message}`;
  }
}

async function handleDataTransform(args: any) {
  try {
    const { input, operation, options = {} } = args;
    if (!input) return '请提供输入数据';

    let data = input;
    const db = repo.db;
    if (db && input.match(/^[a-f0-9-]{36}$/)) {
      const row = db.prepare("SELECT content FROM creativities WHERE id = ? AND status = 'active'").get(input);
      if (row) data = row.content;
    }

    switch (operation) {
      case 'json_to_csv': {
        const jsonData = JSON.parse(data);
        if (!Array.isArray(jsonData) || jsonData.length === 0) return 'JSON 数据必须是非空数组';
        const headers = Object.keys(jsonData[0]);
        const csvLines = [headers.join(',')];
        for (const item of jsonData) {
          csvLines.push(headers.map(h => `"${String(item[h] || '').replace(/"/g, '""')}"`).join(','));
        }
        return csvLines.join('\n');
      }
      case 'csv_to_json': {
        const lines = data.split('\n').filter((l: string) => l.trim());
        if (lines.length < 2) return 'CSV 数据至少需要标题行和一行数据';
        const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''));
        const result = lines.slice(1).map((line: string) => {
          const values = line.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
          const obj: any = {};
          headers.forEach((h: string, i: number) => { obj[h] = values[i] || ''; });
          return obj;
        });
        return JSON.stringify(result, null, 2);
      }
      case 'markdown_to_json': {
        const sections = data.split(/^#{1,3}\s+/m).filter((s: string) => s.trim());
        const result = sections.map((section: string) => {
          const lines = section.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();
          return { title, content };
        });
        return JSON.stringify(result, null, 2);
      }
      case 'json_to_markdown': {
        const jsonData = JSON.parse(data);
        if (Array.isArray(jsonData)) {
          return jsonData.map((item: any, i: number) => `## ${item.title || `项目 ${i + 1}`}\n\n${item.content || JSON.stringify(item, null, 2)}`).join('\n\n');
        }
        return `# ${jsonData.title || '文档'}\n\n${jsonData.content || JSON.stringify(jsonData, null, 2)}`;
      }
      case 'extract_links': {
        const urlRegex = /https?:\/\/[^\s)\]>"']+/g;
        const links = data.match(urlRegex) || [];
        return links.length > 0 ? `找到 ${links.length} 个链接：\n${links.join('\n')}` : '未找到链接';
      }
      case 'extract_keywords': {
        const words = data.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter((w: string) => w.length > 1);
        const freq: any = {};
        for (const w of words) freq[w] = (freq[w] || 0) + 1;
        const sorted = Object.entries(freq).sort(([, a]: any, [, b]: any) => b - a).slice(0, 20);
        return `关键词频率（Top 20）：\n${sorted.map(([word, count]) => `${word}: ${count}`).join('\n')}`;
      }
      case 'regex_match': {
        const pattern = options.pattern;
        if (!pattern) return 'regex_match 操作需要提供 options.pattern';
        const regex = new RegExp(pattern, options.flags || 'g');
        const matches = data.match(regex) || [];
        return matches.length > 0 ? `匹配到 ${matches.length} 项：\n${matches.join('\n')}` : '未找到匹配';
      }
      case 'text_stats': {
        const charCount = data.length;
        const wordCount = data.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter((w: string) => w).length + (data.match(/[\u4e00-\u9fa5]/g) || []).length;
        const lineCount = data.split('\n').length;
        const paraCount = data.split(/\n\s*\n/).filter((p: string) => p.trim()).length;
        return `文本统计：\n字符数：${charCount}\n词数（中文字+英文词）：${wordCount}\n行数：${lineCount}\n段落数：${paraCount}`;
      }
      default:
        return `不支持的操作: ${operation}`;
    }
  } catch (err: any) {
    return `数据转换失败: ${err.message}`;
  }
}

// ---- 4. 预览：预览创意内容 ----

async function handlePreviewCreativity(args: any) {
  try {
    const db = repo.db;
    if (!db) return '数据库未初始化';

    const { id, format = 'markdown' } = args;
    const row = db.prepare("SELECT * FROM creativities WHERE id = ? AND status = 'active'").get(id);
    if (!row) return `未找到 ID 为 "${id}" 的创意`;

    const item = repo.toCamelCase(row);
    try {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('preview:creativity', { id, title: item.title, content: item.content, format });
        }
      }
    } catch { /* ignore */ }

    return `已打开创意预览：${item.title}\n\n内容预览：\n${(item.content || '').substring(0, 500)}${(item.content || '').length > 500 ? '...' : ''}`;
  } catch (err: any) {
    return `预览创意失败: ${err.message}`;
  }
}

async function handlePreviewMarkdown(args: any) {
  try {
    const { content, title = '预览', saveAsCreativity = false } = args;
    if (!content) return '请提供要预览的 Markdown 内容';

    try {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('preview:markdown', { content, title });
        }
      }
    } catch { /* ignore */ }

    let saveMsg = '';
    if (saveAsCreativity) {
      try {
        const db = repo.db;
        if (db) {
          const now = new Date().toISOString();
          const id = generateId();
          db.prepare('INSERT INTO creativities (id, title, content, type, subtype, tags, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, title, content, 'text', 'markdown', '[]', 'active', content.length, now, now);
          saveMsg = `\n\n已保存为创意 (ID: ${id})`;
          notifyCreativityChange();
        }
      } catch (e: any) {
        saveMsg = `\n\n保存为创意失败: ${e.message}`;
      }
    }

    return `已打开 Markdown 预览：${title}${saveMsg}\n\n内容摘要：\n${content.substring(0, 300)}${content.length > 300 ? '...' : ''}`;
  } catch (err: any) {
    return `预览 Markdown 失败: ${err.message}`;
  }
}

async function handleGenerateAndPreview(args: any) {
  try {
    const { prompt, format = 'article', saveAsCreativity = true } = args;
    if (!prompt) return '请提供生成内容的提示词';

    const formatMap: any = {
      article: '一篇完整的文章',
      report: '一份结构化的报告',
      story: '一个引人入胜的故事',
      poem: '一首优美的诗歌',
      outline: '一个清晰的大纲',
      summary: '一份简洁的摘要',
    };

    const { chat } = require('./ai-service');
    const aiConfig = currentAIConfig || { provider: 'openai', model: 'gpt-4o-mini' };
    const generated = await chat(aiConfig, [
      { role: 'system', content: `你是一位专业的内容创作者。请根据用户的需求生成${formatMap[format] || '内容'}。使用 Markdown 格式输出，确保结构清晰、内容丰富。` },
      { role: 'user', content: prompt },
    ]);

    try {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('preview:markdown', { content: generated, title: `${formatMap[format] || '内容'} - 预览` });
        }
      }
    } catch { /* ignore */ }

    let saveMsg = '';
    if (saveAsCreativity) {
      try {
        const db = repo.db;
        if (db) {
          const now = new Date().toISOString();
          const id = generateId();
          const title = `${formatMap[format] || '内容'} - ${new Date().toLocaleDateString('zh-CN')}`;
          db.prepare('INSERT INTO creativities (id, title, content, type, subtype, tags, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, title, generated, 'text', format, '[]', 'active', generated.length, now, now);
          saveMsg = `\n\n已保存为创意 (ID: ${id})`;
          notifyCreativityChange();
        }
      } catch (e: any) {
        saveMsg = `\n\n保存为创意失败: ${e.message}`;
      }
    }

    return `已生成${formatMap[format] || '内容'}并打开预览${saveMsg}\n\n生成内容摘要：\n${generated.substring(0, 300)}${generated.length > 300 ? '...' : ''}`;
  } catch (err: any) {
    return `生成并预览失败: ${err.message}`;
  }
}

// ---- 5. 联网搜索：搜索和用户任务相关的网页内容 ----

async function handleSearchAndSave(args: any) {
  try {
    const { query, saveToBoard, maxResults = 5, autoSummarize = true } = args;
    if (!query) return '请提供搜索查询内容';

    const { webSearch } = require('./ai-service');
    const searchResult = await webSearch(query);
    if (!searchResult) return '搜索未返回结果';

    let savedMsg = '';
    try {
      const db = repo.db;
      if (db) {
        const now = new Date().toISOString();
        const id = generateId();
        const title = `搜索：${query} - ${new Date().toLocaleDateString('zh-CN')}`;
        let content = searchResult;

        if (autoSummarize) {
          try {
            const { chat } = require('./ai-service');
            const aiConfig = currentAIConfig || { provider: 'openai', model: 'gpt-4o-mini' };
            const summary = await chat(aiConfig, [
              { role: 'system', content: '请将以下搜索结果整理为结构化的笔记，提取关键信息，去除广告和无关内容。使用 Markdown 格式。' },
              { role: 'user', content: searchResult },
            ]);
            content = `## 搜索结果整理\n\n**查询：** ${query}\n\n${summary}\n\n---\n\n## 原始搜索结果\n\n${searchResult}`;
          } catch { /* ignore */ }
        }

        db.prepare('INSERT INTO creativities (id, title, content, type, subtype, tags, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, title, content, 'text', 'search', JSON.stringify(['搜索', query]), 'active', content.length, now, now);

        if (saveToBoard) {
          db.prepare('INSERT OR IGNORE INTO board_items (board_id, creativity_id, added_at) VALUES (?, ?, ?)').run(saveToBoard, id, now);
        }

        savedMsg = `\n\n已保存为创意 (ID: ${id})`;
        notifyCreativityChange();
      }
    } catch (e: any) {
      savedMsg = `\n\n保存为创意失败: ${e.message}`;
    }

    return `搜索完成${savedMsg}\n\n搜索结果：\n${searchResult.substring(0, 1000)}${searchResult.length > 1000 ? '...' : ''}`;
  } catch (err: any) {
    return `搜索并保存失败: ${err.message}`;
  }
}

async function handleDeepResearch(args: any) {
  try {
    const { topic, depth = 3, saveAsCreativity = true, aspects = [] } = args;
    if (!topic) return '请提供研究主题';

    const { webSearch, chat } = require('./ai-service');
    const aiConfig = currentAIConfig || { provider: 'openai', model: 'gpt-4o-mini' };

    const searchQueries = [topic];
    if (aspects.length > 0) {
      for (const aspect of aspects) {
        searchQueries.push(`${topic} ${aspect}`);
      }
    }

    const allResults: string[] = [];
    const actualDepth = Math.min(depth, 5);

    for (let i = 0; i < actualDepth && i < searchQueries.length; i++) {
      try {
        const result = await webSearch(searchQueries[i]);
        if (result) allResults.push(`### 搜索：${searchQueries[i]}\n\n${result}`);
      } catch { /* ignore */ }
    }

    if (allResults.length === 0) return '深度研究未找到任何结果';

    const combinedResults = allResults.join('\n\n---\n\n');
    const researchReport = await chat(aiConfig, [
      { role: 'system', content: `你是一位专业的研究分析师。请基于提供的搜索结果，生成一份关于"${topic}"的深度研究报告。

报告要求：
1. 使用 Markdown 格式
2. 包含标题、摘要、正文（分章节）、结论
3. 综合多个来源的信息，标注关键观点
4. 如有不同观点，客观呈现各方立场
5. 提供实用建议或行动要点` },
      { role: 'user', content: combinedResults },
    ]);

    let savedMsg = '';
    if (saveAsCreativity) {
      try {
        const db = repo.db;
        if (db) {
          const now = new Date().toISOString();
          const id = generateId();
          const title = `深度研究：${topic} - ${new Date().toLocaleDateString('zh-CN')}`;
          db.prepare('INSERT INTO creativities (id, title, content, type, subtype, tags, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, title, researchReport, 'text', 'research', JSON.stringify(['深度研究', topic]), 'active', researchReport.length, now, now);
          savedMsg = `\n\n研究报告已保存为创意 (ID: ${id})`;
          notifyCreativityChange();
        }
      } catch (e: any) {
        savedMsg = `\n\n保存研究报告失败: ${e.message}`;
      }
    }

    try {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('preview:markdown', { content: researchReport, title: `深度研究：${topic}` });
        }
      }
    } catch { /* ignore */ }

    return `深度研究完成！共进行 ${allResults.length} 轮搜索${savedMsg}\n\n研究报告摘要：\n${researchReport.substring(0, 500)}${researchReport.length > 500 ? '...' : ''}`;
  } catch (err: any) {
    return `深度研究失败: ${err.message}`;
  }
}

module.exports = {
  getToolDefinitions,
  executeTool,
  setAIConfig,
};
