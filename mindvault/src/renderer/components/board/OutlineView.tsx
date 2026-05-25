import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3, 
  Hash, 
  PanelLeftClose, 
  PanelLeftOpen,
  Maximize2,
  Plus,
  Save,
  Trash2,
  FileText,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  Undo2,
  Redo2,
  Wand2,
  SpellCheck,
  Search,
  History,
  ListTree,
  X,
  Replace,
  ChevronLeft,
  StickyNote,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

import { Menu, Popconfirm, Drawer, Tree, Timeline, Tag, Statistic, Tooltip, Empty, Typography, Popover } from 'antd';
import { useUIStore } from '../../stores/uiStore';
import { writingApi, WritingVolume, WritingChapter } from '../../utils/writingApi';

const SearchIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={style}
  >
    <g stroke="var(--text-tertiary)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
      <path fill="var(--text-tertiary)" fill-opacity="0" stroke-dasharray="40" d="M10.76 13.24c-2.34 -2.34 -2.34 -6.14 0 -8.49c2.34 -2.34 6.14 -2.34 8.49 0c2.34 2.34 2.34 6.14 0 8.49c-2.34 2.34 -6.14 2.34 -8.49 0Z">
        <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.5s" values="40;0"/>
        <animate fill="freeze" attributeName="fill-opacity" begin="0.7s" dur="0.15s" to=".3"/>
      </path>
      <path fill="none" stroke-dasharray="14" stroke-dashoffset="14" d="M10.5 13.5l-7.5 7.5">
        <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.5s" dur="0.2s" to="0"/>
      </path>
    </g>
  </svg>
);

interface OutlineViewProps {
  boardId?: string;
  onCardClick?: (c: WritingChapter) => void;
  selectedId?: string;
}

const OutlineView: React.FC<OutlineViewProps> = ({
  boardId,
  onCardClick,
  selectedId,
}) => {
  // 使用独立的写作台存储
  const [chapters, setChapters] = useState<WritingChapter[]>([]);
  const [volumes, setVolumes] = useState<WritingVolume[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(selectedId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('mindvault_sidebar_collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const initializedRef = useRef(false);
  const [isEditingVolumeTitle, setIsEditingVolumeTitle] = useState<string | null>(null);
  const [editingVolumeTitle, setEditingVolumeTitle] = useState('');
  const volumeTitleInputRef = useRef<HTMLInputElement>(null);
  
  const focusMode = useUIStore((s) => s.focusMode);
  const setFocusMode = useUIStore((s) => s.setFocusMode);
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode);
  const [isEditing, setIsEditing] = useState(false);
  const [focusToolbarVisible, setFocusToolbarVisible] = useState(false);
  const focusToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focusMode) {
      setFocusToolbarVisible(false);
      return;
    }
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isOnToolbar = target.closest('[data-focus-toolbar]');
      if (e.clientY <= 40 || isOnToolbar) {
        if (focusToolbarTimerRef.current) {
          clearTimeout(focusToolbarTimerRef.current);
          focusToolbarTimerRef.current = null;
        }
        setFocusToolbarVisible(true);
      } else if (focusToolbarVisible) {
        if (!focusToolbarTimerRef.current) {
          focusToolbarTimerRef.current = setTimeout(() => {
            setFocusToolbarVisible(false);
            focusToolbarTimerRef.current = null;
          }, 600);
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (focusToolbarTimerRef.current) {
        clearTimeout(focusToolbarTimerRef.current);
      }
    };
  }, [focusMode, focusToolbarVisible]);

  // 内联编辑状态
  const [editingField, setEditingField] = useState<'title' | 'content' | 'tag' | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | number | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const editTitleRef = useRef<HTMLDivElement>(null);
  const editContentRef = useRef<HTMLTextAreaElement>(null);
  const editTagRef = useRef<HTMLInputElement>(null);
  
  // 输入法组合状态
  const isComposingRef = useRef(false);
  
  // 自动保存
  const [lastSavedTime, setLastSavedTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  // 写作统计
  const [todayWordCount, setTodayWordCount] = useState(0);
  const [writingStartTime, setWritingStartTime] = useState<Date | null>(null);
  const [sessionWordCount, setSessionWordCount] = useState(0);

  // 撤回/前进
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const lastEditContentRef = useRef('');

  // 查找&替换
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findResults, setFindResults] = useState<number>(0);
  const [findCurrentIndex, setFindCurrentIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // 历史版本
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; content: string; title: string; timestamp: number; wordCount: number }>>([]);

  // 大纲面板
  const [outlineOpen, setOutlineOpen] = useState(false);

  // 便利签
  const [stickyNotes, setStickyNotes] = useState<Array<{ id: string; title: string; content: string; color: string }>>([]);
  const [stickyNotesOpen, setStickyNotesOpen] = useState(false);
  const [stickyPopoverOpen, setStickyPopoverOpen] = useState(false);

  // 纠错面板
  const [spellCheckOpen, setSpellCheckOpen] = useState(false);
  const [spellErrors, setSpellErrors] = useState<Array<{ text: string; suggestion: string; index: number; length: number }>>([]);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 右键菜单：点击外部关闭
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu.visible]);

  // 侧边栏收起状态持久化
  useEffect(() => {
    try {
      localStorage.setItem('mindvault_sidebar_collapsed', JSON.stringify(sidebarCollapsed));
    } catch (e) {
      console.error('保存侧边栏状态失败:', e);
    }
  }, [sidebarCollapsed]);

  // 获取某卷的章节
  const getChaptersForVolume = (volumeId: string) => {
    return chapters.filter(c => c.volumeId === volumeId);
  };

  // 获取没有归属卷的章节
  const getUnassignedChapters = () => {
    return chapters.filter(c => !c.volumeId);
  };

  // 初始化数据 - 使用独立的写作台存储
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // 先尝试迁移旧数据
    writingApi.migrateFromCreativities().then(result => {
      if (result.migrated > 0) {
        console.log('[Writing] 迁移完成:', result.message);
      }
    });
    
    // 加载卷数据
    writingApi.listVolumes(boardId).then(loadedVolumes => {
      if (loadedVolumes.length === 0) {
        // 如果没有卷，默认创建一个第一卷
        writingApi.createVolume({ boardId, title: '第一卷' }).then(newVolume => {
          if (newVolume) {
            setVolumes([newVolume]);
            setExpandedKeys([newVolume.id]);
          }
        });
      } else {
        setVolumes(loadedVolumes);
        setExpandedKeys(loadedVolumes.map(v => v.id));
      }
    });
    
    // 加载章节数据
    writingApi.listChapters(undefined, boardId).then(loadedChapters => {
      setChapters(loadedChapters);
      
      // 恢复上一次选中的章节
      try {
        const lastSelectedId = localStorage.getItem('mindvault_last_selected_chapter_' + (boardId || 'default'));
        if (lastSelectedId) {
          const lastSelected = loadedChapters.find((c) => c.id === lastSelectedId);
          if (lastSelected) {
            setSelectedItemId(lastSelectedId);
            setEditContent(lastSelected.content || '');
            setEditingField('content');
            setIsEditing(true);
            if (!writingStartTime) {
              setWritingStartTime(new Date());
            }
            // 如果这个章节属于某个卷，确保该卷是展开的
            const volumeId = (lastSelected as any).volumeId;
            if (volumeId) {
              setExpandedKeys(prev => prev.includes(volumeId) ? prev : [...prev, volumeId]);
            }
            setTimeout(() => {
              const textarea = editContentRef.current;
              if (textarea) {
                textarea.focus();
                // 恢复光标位置
                try {
                  const cursorPosStr = localStorage.getItem('mindvault_cursor_position_' + lastSelectedId);
                  if (cursorPosStr) {
                    const cursorPos = JSON.parse(cursorPosStr);
                    const maxPos = lastSelected.content ? lastSelected.content.length : 0;
                    textarea.setSelectionRange(
                      Math.min(cursorPos.start, maxPos),
                      Math.min(cursorPos.end, maxPos)
                    );
                  }
                } catch (err) {
                  console.error('恢复光标位置失败:', err);
                }
              }
            }, 300);
          }
        }
      } catch (e) {
        console.error('恢复选中章节失败:', e);
      }
    });

    // 加载便利签列表
    if (boardId && window.electronAPI?.board?.sticky?.list) {
      window.electronAPI.board.sticky.list(boardId).then((notes: any[]) => {
        if (Array.isArray(notes)) {
          setStickyNotes(notes.map((n: any) => ({
            id: n.id,
            title: n.title || '无标题',
            content: n.content || '',
            color: n.color || '#FFF9C4',
          })));
        }
      }).catch((err: any) => {
        console.error('加载便利签失败:', err);
      });
    }
  }, [boardId]);

  const selectedChapter = useMemo(() => {
    const id = selectedItemId || selectedId;
    return id ? chapters.find((c) => c.id === id) : null;
  }, [selectedItemId, selectedId, chapters]);

  // 当选中章节变化时，自动更新 editContent
  useEffect(() => {
    if (selectedChapter) {
      setEditContent(selectedChapter.content || '');
    }
  }, [selectedChapter?.id]);

  const handleItemClick = (c: WritingChapter) => {
    setSelectedItemId(c.id);
    // 保存选中的章节到 localStorage
    try {
      localStorage.setItem('mindvault_last_selected_chapter_' + (boardId || 'default'), c.id);
    } catch (e) {
      console.error('保存选中章节失败:', e);
    }
    // 选中后立即进入编辑模式
    setEditContent(c.content || '');
    setEditingField('content');
    setIsEditing(true);
    if (!writingStartTime) {
      setWritingStartTime(new Date());
    }
    setTimeout(() => {
      const textarea = editContentRef.current;
      if (textarea) {
        textarea.focus();
        // 恢复光标位置
        try {
          const cursorPosStr = localStorage.getItem('mindvault_cursor_position_' + c.id);
          if (cursorPosStr) {
            const cursorPos = JSON.parse(cursorPosStr);
            const maxPos = c.content ? c.content.length : 0;
            textarea.setSelectionRange(
              Math.min(cursorPos.start, maxPos),
              Math.min(cursorPos.end, maxPos)
            );
          }
        } catch (err) {
          console.error('恢复光标位置失败:', err);
        }
      }
    }, 150);
  };

  const handleEdit = () => {
    // 写作台不再使用编辑器弹窗，直接在页面内编辑
  };

  // 开始内联编辑标题
  const startEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedChapter) {
      setEditTitle(selectedChapter.title || '');
      setEditingField('title');
      setTimeout(() => {
        if (editTitleRef.current) {
          editTitleRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(editTitleRef.current);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }, 50);
    }
  };

  // 开始编辑内容（写作模式）
  const startEditContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedChapter) {
      setEditContent(selectedChapter.content || '');
      setEditingField('content');
      setIsEditing(true);
      if (!writingStartTime) {
        setWritingStartTime(new Date());
      }
      setTimeout(() => editContentRef.current?.focus(), 50);
    }
  };

  // 开始内联编辑标签
  const startEditTag = (e: React.MouseEvent, tag: any) => {
    e.stopPropagation();
    // 写作台章节不再使用标签系统
  };

  // 保存编辑 - 使用独立的写作台存储
  const saveEdit = async () => {
    if (!selectedChapter || !editingField) return;
    
    try {
      setIsSaving(true);
      
      if (editingField === 'title') {
        await writingApi.updateChapter(selectedChapter.id, { title: editTitle });
        setChapters((prev) => prev.map((c) => 
          c.id === selectedChapter.id ? { ...c, title: editTitle } : c
        ));
      } else if (editingField === 'content') {
        const wordCount = (editContent || '').length;
        const oldWordCount = selectedChapter.content?.length || 0;
        const diff = wordCount - oldWordCount;
        
        await writingApi.updateChapter(selectedChapter.id, { content: editContent });
        setChapters((prev) => prev.map((c) => 
          c.id === selectedChapter.id ? { ...c, content: editContent, wordCount } : c
        ));
        
        if (diff > 0) {
          setSessionWordCount((prev) => prev + diff);
        }
      }
      
      setLastSavedTime(Date.now());
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setEditingField(null);
      setEditingTagId(null);
      setIsSaving(false);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingField(null);
    setEditingTagId(null);
    setIsEditing(false);
  };
  
  // 计算当前内容的字数（用于内容编辑时实时更新）
  const currentWordCount = useMemo(() => {
    if (editingField === 'content') {
      return editContent.length;
    }
    return selectedChapter?.wordCount || 0;
  }, [selectedChapter, editingField, editContent]);
  
  // 实时统计
  const currentContentWordCount = (editContent || selectedChapter?.content || '').length;
  const characterCount = editContent?.length || selectedChapter?.content?.length || 0;
  
  // 计算章节字数
  const chapterWordCount = useMemo(() => {
    if (editingField === 'content') {
      return editContent.length;
    }
    return selectedChapter?.wordCount || 0;
  }, [selectedChapter, editingField, editContent]);
  
  // 格式化时间
  const formatTime = (date: Date | null) => {
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    return `${hours} 小时前`;
  };

  const truncateTitle = (title: string, maxLen: number) => {
    return title.length > maxLen ? title.slice(0, maxLen) + '...' : title;
  };

  // 撤回/前进功能
  const pushUndo = (content: string) => {
    // 如果正在输入法组合中，不保存到历史记录
    if (isComposingRef.current) return;
    
    if (content !== lastEditContentRef.current) {
      setUndoStack(prev => [...prev.slice(-50), lastEditContentRef.current]);
      setRedoStack([]);
      lastEditContentRef.current = content;
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(s => [...s, editContent]);
    setUndoStack(s => s.slice(0, -1));
    setEditContent(prev);
    lastEditContentRef.current = prev;
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(s => [...s, editContent]);
    setRedoStack(s => s.slice(0, -1));
    setEditContent(next);
    lastEditContentRef.current = next;
  };

  // 一键排版
  const handleAutoFormat = () => {
    let text = editContent;
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/^(\s*)#{1,6}\s*/gm, (match, spaces) => {
      return spaces + match.trim() + ' ';
    });
    text = text.replace(/([。！？；：])\s{2,}/g, '$1');
    text = text.replace(/([，、])\s{2,}/g, '$1');
    text = text.replace(/\s+([。！？；：，、])/g, '$1');
    text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
    text = text.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
    text = text.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
    text = text.replace(/^\s+$/gm, '');
    text = text.trim();
    pushUndo(editContent);
    setEditContent(text);
  };

  // 纠错字
  const TYPO_MAP: Record<string, string> = {
    '己经': '已经',
    '己知': '已知',
    '那未': '那么',
    '既使': '即使',
    '凑和': '凑合',
    '迫不急待': '迫不及待',
    '一愁莫展': '一筹莫展',
    '按步就班': '按部就班',
    '金壁辉煌': '金碧辉煌',
    '一如继往': '一如既往',
    '一诺千斤': '一诺千金',
    '甘败下风': '甘拜下风',
    '自暴自起': '自暴自弃',
    '走头无路': '走投无路',
    '天崖海角': '天涯海角',
    '融汇贯通': '融会贯通',
    '默守成规': '墨守成规',
    '名符其实': '名副其实',
    '换然一新': '焕然一新',
    '娇生贯养': '娇生惯养',
    '不径而走': '不胫而走',
    '竭泽而鱼': '竭泽而渔',
    '老声常谈': '老生常谈',
    '山洪爆法': '山洪暴发',
    '一张一驰': '一张一弛',
    '世外桃园': '世外桃源',
    '声名雀起': '声名鹊起',
    '鬼斧神功': '鬼斧神工',
    '一鼓做气': '一鼓作气',
    '悬梁刺骨': '悬梁刺股',
    '食不裹腹': '食不果腹',
    '落英宾纷': '落英缤纷',
    '心无旁鹜': '心无旁骛',
    '黄梁美梦': '黄粱美梦',
    '美仑美奂': '美轮美奂',
    '幅射': '辐射',
    '安祥': '安详',
    '按装': '安装',
    '暴炸': '爆炸',
    '必竟': '毕竟',
    '布署': '部署',
    '苍桑': '沧桑',
    '穿流不息': '川流不息',
    '渡假': '度假',
    '防碍': '妨碍',
    '分岐': '分歧',
    '奋怒': '愤怒',
    '概叹': '慨叹',
    '鬼计': '诡计',
    '寒喧': '寒暄',
    '好高务远': '好高骛远',
    '宏扬': '弘扬',
    '急燥': '急躁',
    '记帐': '记账',
    '坚如盘石': '坚如磐石',
    '娇健': '矫健',
    '桔据': '拮据',
    '精减': '精简',
    '决窍': '诀窍',
    '刻服': '克服',
    '烂调': '滥调',
    '历害': '厉害',
    '联篇累牍': '连篇累牍',
    '留传': '流传',
    '罗嗦': '啰嗦',
    '迷天大谎': '弥天大谎',
    '勉厉': '勉励',
    '明查暗访': '明察暗访',
    '磨拳擦掌': '摩拳擦掌',
    '凭心而论': '平心而论',
    '前扑后继': '前仆后继',
    '清烈': '清冽',
    '人才挤挤': '人才济济',
    '如法泡制': '如法炮制',
    '三翻五次': '三番五次',
    '山青水秀': '山清水秀',
    '伸士': '绅士',
    '声势凶凶': '声势汹汹',
    '手屈一指': '首屈一指',
    '水乳交溶': '水乳交融',
    '提心掉胆': '提心吊胆',
    '挺而走险': '铤而走险',
    '歪风斜气': '歪风邪气',
    '忘想': '妄想',
    '文过是非': '文过饰非',
    '无动于中': '无动于衷',
    '无可奈河': '无可奈何',
    '无与伦此': '无与伦比',
    '相辅相承': '相辅相成',
    '消声匿迹': '销声匿迹',
    '心旷神疑': '心旷神怡',
    '兴兴向荣': '欣欣向荣',
    '虚废声势': '虚张声势',
    '一翻风顺': '一帆风顺',
    '义愤填鹰': '义愤填膺',
    '因漏守旧': '因循守旧',
    '源远流常': '源远流长',
    '再接再励': '再接再厉',
    '张灯结采': '张灯结彩',
    '震聋发聩': '振聋发聩',
    '至理明言': '至理名言',
    '中流抵柱': '中流砥柱',
    '自园其说': '自圆其说',
  };

  const handleSpellCheck = () => {
    const errors: Array<{ text: string; suggestion: string; index: number; length: number }> = [];
    for (const [wrong, correct] of Object.entries(TYPO_MAP)) {
      let searchFrom = 0;
      while (true) {
        const idx = editContent.indexOf(wrong, searchFrom);
        if (idx === -1) break;
        errors.push({ text: wrong, suggestion: correct, index: idx, length: wrong.length });
        searchFrom = idx + wrong.length;
      }
    }
    errors.sort((a, b) => a.index - b.index);
    setSpellErrors(errors);
    setSpellCheckOpen(true);
  };

  const applySpellFix = (error: typeof spellErrors[0]) => {
    pushUndo(editContent);
    const newContent = editContent.substring(0, error.index) + error.suggestion + editContent.substring(error.index + error.length);
    setEditContent(newContent);
    setSpellErrors(prev => prev.filter(e => e.index !== error.index).map(e => {
      if (e.index > error.index) {
        return { ...e, index: e.index + (error.suggestion.length - error.length) };
      }
      return e;
    }));
  };

  const applyAllSpellFixes = () => {
    pushUndo(editContent);
    let newContent = editContent;
    const sorted = [...spellErrors].sort((a, b) => b.index - a.index);
    for (const error of sorted) {
      newContent = newContent.substring(0, error.index) + error.suggestion + newContent.substring(error.index + error.length);
    }
    setEditContent(newContent);
    setSpellErrors([]);
  };

  // 查找&替换
  const handleFind = () => {
    if (!findText) {
      setFindResults(0);
      setFindCurrentIndex(0);
      return;
    }
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [...editContent.matchAll(regex)];
    setFindResults(matches.length);
    setFindCurrentIndex(matches.length > 0 ? 1 : 0);
  };

  useEffect(() => {
    if (findReplaceOpen && findText) {
      handleFind();
    } else {
      setFindResults(0);
      setFindCurrentIndex(0);
    }
  }, [findText, editContent, findReplaceOpen]);

  const handleReplaceOne = () => {
    if (!findText || findResults === 0) return;
    pushUndo(editContent);
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const newContent = editContent.replace(regex, replaceText);
    setEditContent(newContent);
  };

  const handleReplaceAll = () => {
    if (!findText || findResults === 0) return;
    pushUndo(editContent);
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newContent = editContent.replace(regex, replaceText);
    setEditContent(newContent);
  };

  // 历史版本
  const loadVersions = (creativityId: string) => {
    try {
      const saved = localStorage.getItem('mindvault_versions_' + creativityId);
      if (saved) {
        setVersions(JSON.parse(saved));
      } else {
        setVersions([]);
      }
    } catch {
      setVersions([]);
    }
  };

  const saveVersion = () => {
    if (!selectedChapter) return;
    const version = {
      id: 'v_' + Date.now(),
      content: editContent,
      title: selectedChapter.title || '',
      timestamp: Date.now(),
      wordCount: editContent.length
    };
    const newVersions = [version, ...versions].slice(0, 20);
    setVersions(newVersions);
    try {
      localStorage.setItem('mindvault_versions_' + selectedChapter.id, JSON.stringify(newVersions));
    } catch (e) {
      console.error('保存版本失败:', e);
    }
  };

  const restoreVersion = (version: typeof versions[0]) => {
    pushUndo(editContent);
    setEditContent(version.content);
    setHistoryOpen(false);
  };

  // 大纲
  const outlineItems = useMemo(() => {
    const content = editingField === 'content' ? editContent : (selectedChapter?.content || '');
    const lines = content.split('\n');
    const items: Array<{ level: number; text: string; lineIndex: number }> = [];
    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        items.push({ level: match[1].length, text: match[2].trim(), lineIndex: idx });
      }
    });
    return items;
  }, [editContent, selectedChapter, editingField]);

  const outlineTreeData = useMemo(() => {
    if (outlineItems.length === 0) return [];
    let idx = 0;
    function buildLevel(parentLevel: number): any[] {
      const nodes: any[] = [];
      while (idx < outlineItems.length) {
        const item = outlineItems[idx];
        if (item.level <= parentLevel) break;
        const node: any = {
          key: `h-${item.lineIndex}`,
          title: item.text,
          level: item.level,
          lineIndex: item.lineIndex,
          nodeType: 'heading',
        };
        idx++;
        if (idx < outlineItems.length && outlineItems[idx].level > item.level) {
          node.children = buildLevel(item.level);
        }
        nodes.push(node);
      }
      return nodes;
    }
    return buildLevel(0);
  }, [outlineItems]);

  const renderOutlineNode = (nodeData: any) => {
    return (
      <span
        onClick={() => scrollToHeading(nodeData.lineIndex)}
        style={{
          cursor: 'pointer',
          color: nodeData.level === 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: nodeData.level === 1 ? 13 : 12,
          fontWeight: nodeData.level <= 2 ? 600 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginRight: 4 }}>
          {'#'.repeat(nodeData.level)}
        </span>
        {nodeData.title}
      </span>
    );
  };

  const scrollToHeading = (lineIndex: number) => {
    if (editingField === 'content' && editContentRef.current) {
      const lines = editContent.split('\n');
      let pos = 0;
      for (let i = 0; i < lineIndex; i++) {
        pos += lines[i].length + 1;
      }
      editContentRef.current.focus();
      editContentRef.current.setSelectionRange(pos, pos);
      const lineHeight = 28;
      editContentRef.current.scrollTop = pos * 0.5;
    }
  };
  
  // 新建卷
  const handleCreateVolume = async () => {
    const newVolume = await writingApi.createVolume({ 
      boardId, 
      title: `第${volumes.length + 1}卷` 
    });
    if (newVolume) {
      setVolumes(prev => [...prev, newVolume]);
      setExpandedKeys(prev => [...prev, newVolume.id]);
    }
  };

  // 新建章节（归属到选中的卷或第一个卷）
  const handleCreateChapter = async (volumeId?: string) => {
    let targetVolumeId = volumeId;
    if (!targetVolumeId && volumes.length > 0) {
      targetVolumeId = volumes[0].id;
    }
    if (!targetVolumeId) {
      console.error('没有可用的卷来归属章节');
      return;
    }
    
    try {
      // 使用独立的写作台存储创建章节
      const newChapter = await writingApi.createChapter({
        volumeId: targetVolumeId,
        boardId,
        title: '新章节',
        content: ''
      });
      
      if (newChapter) {
        setChapters(prev => [...prev, newChapter]);
        setSelectedItemId(newChapter.id);
        setEditContent('');
        setEditingField('content');
        setIsEditing(true);
        if (!writingStartTime) {
          setWritingStartTime(new Date());
        }
        setTimeout(() => editContentRef.current?.focus(), 150);
      }
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  // 插入便利签内容到光标位置
  const handleInsertStickyNote = (note: { id: string; title: string; content: string; color: string }) => {
    const textarea = editContentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insertText = note.content || note.title;
    const newContent = editContent.substring(0, start) + insertText + editContent.substring(end);
    setEditContent(newContent);
    setStickyPopoverOpen(false);
    setTimeout(() => {
      if (editContentRef.current) {
        const newPos = start + insertText.length;
        editContentRef.current.focus();
        editContentRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  // 删除卷
  const handleDeleteVolume = async (volumeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // 使用独立的写作台存储删除卷
      await writingApi.deleteVolume(volumeId);
      setVolumes(prev => prev.filter(v => v.id !== volumeId));
      // 章节会被级联删除
      setChapters(prev => prev.filter(c => c.volumeId !== volumeId));
    } catch (e) {
      console.error('删除卷失败:', e);
    }
  };

  const volumeTreeData = useMemo(() => {
    const data: any[] = [];
    for (const volume of volumes) {
      const chapters = getChaptersForVolume(volume.id);
      data.push({
        key: volume.id,
        title: volume.title,
        nodeType: 'volume',
        volumeData: volume,
        chapterCount: chapters.length,
        children: chapters.length === 0
          ? [{ key: `empty-${volume.id}`, title: '暂无章节', nodeType: 'empty', isLeaf: true, disabled: true, selectable: false }]
          : chapters.map(c => ({
              key: c.id,
              title: c.title || '',
              nodeType: 'chapter',
              chapterData: c,
              isLeaf: true,
            })),
      });
    }
    const unassigned = getUnassignedChapters();
    if (unassigned.length > 0) {
      data.push({
        key: 'unassigned',
        title: '未归属章节',
        nodeType: 'unassigned',
        chapterCount: unassigned.length,
        children: unassigned.map(c => ({
          key: c.id,
          title: c.title || '',
          nodeType: 'chapter',
          chapterData: c,
          isLeaf: true,
        })),
      });
    }
    return data;
  }, [volumes, chapters]);

  const renderVolumeTreeNode = (nodeData: any) => {
    if (nodeData.nodeType === 'volume') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', paddingRight: 4 }}>
          <span style={{ fontSize: 16 }}>📖</span>
          {isEditingVolumeTitle === nodeData.key ? (
            <input
              ref={volumeTitleInputRef}
              type="text"
              value={editingVolumeTitle}
              onChange={(e) => setEditingVolumeTitle(e.target.value)}
              onBlur={async () => {
                if (editingVolumeTitle.trim()) {
                  await writingApi.updateVolume(nodeData.key, { title: editingVolumeTitle.trim() });
                  setVolumes(volumes.map(v =>
                    v.id === nodeData.key ? { ...v, title: editingVolumeTitle.trim() } : v
                  ));
                }
                setIsEditingVolumeTitle(null);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  if (editingVolumeTitle.trim()) {
                    await writingApi.updateVolume(nodeData.key, { title: editingVolumeTitle.trim() });
                    setVolumes(volumes.map(v =>
                      v.id === nodeData.key ? { ...v, title: editingVolumeTitle.trim() } : v
                    ));
                  }
                  setIsEditingVolumeTitle(null);
                } else if (e.key === 'Escape') {
                  setIsEditingVolumeTitle(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid var(--primary-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          ) : (
            <span
              style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingVolumeTitle(nodeData.volumeData.title);
                setIsEditingVolumeTitle(nodeData.key);
              }}
            >
              {nodeData.title}
            </span>
          )}
          <span style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '2px 8px',
            borderRadius: 999
          }}>
            {nodeData.chapterCount}
          </span>
          <Tooltip title="在该卷下添加章节">
            <button
              onClick={(e) => { e.stopPropagation(); handleCreateChapter(nodeData.key); }}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
          <Popconfirm
            title="确定要删除此卷吗？"
            description="删除后可在回收站恢复"
            onConfirm={(e) => handleDeleteVolume(nodeData.key, e as unknown as React.MouseEvent)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除卷">
              <button
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                <Trash2 size={14} />
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      );
    }

    if (nodeData.nodeType === 'unassigned') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <span style={{ fontSize: 14 }}>📁</span>
          <span style={{ flex: 1, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}>{nodeData.title}</span>
          <span style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '2px 8px',
            borderRadius: 999
          }}>
            {nodeData.chapterCount}
          </span>
        </div>
      );
    }

    if (nodeData.nodeType === 'chapter') {
      const c = nodeData.chapterData;
      return (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
          onDoubleClick={(e) => { e.stopPropagation(); onCardClick?.(c); }}
        >
          <span style={{ fontSize: 12 }}>📄</span>
          <Typography.Text ellipsis style={{ flex: 1 }}>
            {c.title || ''}
          </Typography.Text>
          {c.wordCount != null && c.wordCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
              {c.wordCount}
            </span>
          )}
        </div>
      );
    }

    if (nodeData.nodeType === 'empty') {
      return <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)', fontSize: 12 }}>{nodeData.title}</span>;
    }

    return nodeData.title;
  };

  const handleTreeSelect = (selectedKeysValue: React.Key[], info: any) => {
    const nodeData = info.node;
    if (nodeData.nodeType === 'chapter' && nodeData.chapterData) {
      handleItemClick(nodeData.chapterData);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      backgroundColor: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* 左侧目录侧边栏 */}
      <Drawer
        open={!sidebarCollapsed && !focusMode}
        onClose={() => setSidebarCollapsed(true)}
        placement="left"
        width={280}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} style={{ color: 'var(--text-primary)' }} />
            目录导航
          </div>
        }
        mask={false}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        getContainer={false}
      >
            
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button
                onClick={handleCreateVolume}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }}
              >
                <Plus size={14} />
                新建卷
              </button>
              
              <button
                onClick={() => handleCreateChapter()}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--primary-color)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'transform 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Plus size={14} />
                新建章
              </button>
            </div>

            {/* 便利签折叠面板 */}
            {boardId && stickyNotes.length > 0 && (
              <div style={{ padding: '0 16px 8px' }}>
                <div
                  onClick={() => setStickyNotesOpen(!stickyNotesOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: stickyNotesOpen ? 'var(--bg-tertiary)' : 'transparent',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!stickyNotesOpen) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!stickyNotesOpen) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StickyNote size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>便利签</span>
                    <span style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 999,
                      backgroundColor: 'var(--primary-light, #e0e7ff)',
                      color: 'var(--primary-color)',
                      fontWeight: 600
                    }}>
                      {stickyNotes.length}
                    </span>
                  </div>
                  {stickyNotesOpen
                    ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                    : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  }
                </div>
                {stickyNotesOpen && (
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {stickyNotes.map(note => (
                      <div
                        key={note.id}
                        onClick={() => handleInsertStickyNote(note)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title={note.content || note.title}
                      >
                        <div style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: note.color,
                          flexShrink: 0,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {note.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {volumes.length === 0 && getUnassignedChapters().length === 0 ? (
                <div style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: 13
                }}>
                  还没有内容，点击上方按钮新建
                </div>
              ) : (
                <Tree
                  treeData={volumeTreeData}
                  expandedKeys={expandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys as string[])}
                  selectedKeys={selectedItemId ? [selectedItemId] : []}
                  onSelect={handleTreeSelect}
                  titleRender={renderVolumeTreeNode}
                  blockNode
                />
              )}
            </div>
      </Drawer>

      {/* 右侧写作区域 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        overflow: 'hidden'
      }}>
        {/* 展开按钮 */}
        {sidebarCollapsed && !focusMode && (
          <Tooltip title="展开目录">
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 10,
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
            >
              <PanelLeftOpen size={18} />
            </button>
          </Tooltip>
        )}

        <AnimatePresence mode="wait">
          {selectedChapter ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%'
              }}
            >
              {/* 顶部栏 */}
            <div data-focus-toolbar style={{
              padding: focusMode ? '20px 0' : '16px 24px',
              borderBottom: focusMode ? 'none' : '1px solid var(--border-color)',
              backgroundColor: focusMode ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              ...(focusMode ? {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                transform: focusToolbarVisible ? 'translateY(0)' : 'translateY(-100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: focusToolbarVisible ? '0 2px 12px rgba(0,0,0,0.1)' : 'none',
                padding: '16px 24px',
              } : {})
            }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                {editingField === 'title' ? (
                  <div
                    ref={editTitleRef}
                    contentEditable
                    onInput={(e) => setEditTitle(e.currentTarget.textContent || '')}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === 'Escape') {
                        cancelEdit();
                      }
                    }}
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      outline: 'none',
                      padding: '4px 0'
                    }}
                  >
                    {selectedChapter.title}
                  </div>
                ) : (
                  <h1 
                    onDoubleClick={startEditTitle}
                    style={{ 
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {selectedChapter.title}
                  </h1>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ 
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 999,
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    fontWeight: 500
                  }}>
                    📄 章节
                  </span>
                  
                  <span style={{ 
                    fontSize: 12, 
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <FileText size={14} />
                    {currentWordCount.toLocaleString()} 字
                  </span>
                  
                  {lastSavedTime > 0 && (
                    <span style={{ 
                      fontSize: 12, 
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Clock size={14} />
                      {isSaving ? '保存中...' : `保存于 ${formatTime(new Date(lastSavedTime))}`}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => toggleFocusMode()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title={focusMode ? '退出专注模式' : '专注模式'}
                >
                  <Maximize2 size={16} />
                  {focusMode ? '退出' : '专注'}
                </button>
                
                <button
                  onClick={handleEdit}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--primary-color)',
                    color: 'var(--text-inverse)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Edit3 size={16} />
                  创意编辑
                </button>

                {boardId && stickyNotes.length > 0 && (
                  <Popover
                    open={stickyPopoverOpen}
                    onOpenChange={setStickyPopoverOpen}
                    trigger="click"
                    placement="bottomRight"
                    content={
                      <div style={{ maxHeight: 300, overflowY: 'auto', minWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                          插入便利签
                        </div>
                        {stickyNotes.map(note => (
                          <div
                            key={note.id}
                            onClick={() => handleInsertStickyNote(note)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: note.color,
                              flexShrink: 0,
                              border: '1px solid rgba(0,0,0,0.1)'
                            }} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{
                                fontSize: 13,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {note.title}
                              </div>
                              {note.content && (
                                <div style={{
                                  fontSize: 11,
                                  color: 'var(--text-tertiary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: 2
                                }}>
                                  {note.content.substring(0, 60)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <button
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="插入便利签"
                    >
                      <StickyNote size={16} />
                      便利签
                    </button>
                  </Popover>
                )}
              </div>
            </div>





              {/* 大纲面板 */}
              <AnimatePresence>
                {outlineOpen && editingField === 'content' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div style={{ padding: '10px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          文档大纲
                        </span>
                        <button
                          onClick={() => setOutlineOpen(false)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {outlineItems.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>
                          未发现标题，请使用 # 创建标题
                        </div>
                      ) : (
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          <Tree
                            treeData={outlineTreeData}
                            defaultExpandAll
                            size="small"
                            titleRender={renderOutlineNode}
                            selectable={false}
                            blockNode
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* 编辑内容区域 */}
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                padding: focusMode ? '16px 24px' : '32px 24px',
                paddingTop: focusMode ? 20 : 32,
                backgroundColor: focusMode ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <textarea
                  ref={editContentRef}
                  value={editContent}
                  onChange={(e) => {
                    // 只在不在输入法组合过程中才保存历史记录
                    if (!isComposingRef.current) {
                      pushUndo(editContent);
                    }
                    setEditContent(e.target.value);
                  }}
                  onBlur={(e) => {
                    // 保存光标位置
                    if (selectedChapter) {
                      try {
                        localStorage.setItem(
                          'mindvault_cursor_position_' + selectedChapter.id,
                          JSON.stringify({
                            start: e.target.selectionStart,
                            end: e.target.selectionEnd
                          })
                        );
                      } catch (err) {
                        console.error('保存光标位置失败:', err);
                      }
                    }
                    saveEdit();
                  }}
                  onSelect={(e) => {
                    // 保存光标位置
                    if (selectedChapter) {
                      try {
                        localStorage.setItem(
                          'mindvault_cursor_position_' + selectedChapter.id,
                          JSON.stringify({
                            start: e.target.selectionStart,
                            end: e.target.selectionEnd
                          })
                        );
                      } catch (err) {
                        console.error('保存光标位置失败:', err);
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveEdit(); }
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                      e.preventDefault();
                      setFindReplaceOpen(true);
                      setTimeout(() => findInputRef.current?.focus(), 100);
                    }
                  }}
                  // 处理输入法组合事件
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionUpdate={() => {
                    // 组合过程中不做处理
                  }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    // 组合结束后，保存最终结果到历史记录
                    // 此时需要使用当前的 e.target.value，而不是 editContent
                    pushUndo(e.target.value);
                  }}
                  placeholder="开始写作..."
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: focusMode ? 'calc(100vh - 80px)' : 'calc(100vh - 100px)',
                    fontSize: 16,
                    lineHeight: 1.8,
                    color: 'var(--text-primary)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: "var(--font-body)"
                  }}
                />
              </div>

              {/* 右键菜单 */}
              {contextMenu.visible && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.12 }}
                  ref={contextMenuRef}
                  style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: Math.min(contextMenu.x, window.innerWidth - 220),
                    zIndex: 9999,
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                    padding: '6px 0',
                    minWidth: 200,
                    overflow: 'hidden',
                  }}
                >
                  <Menu
                    mode="vertical"
                    style={{ border: 'none', background: 'transparent' }}
                    onClick={({ key }) => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      if (key === 'undo') handleUndo();
                      if (key === 'redo') handleRedo();
                      if (key === 'format') handleAutoFormat();
                      if (key === 'spellcheck') handleSpellCheck();
                      if (key === 'find') {
                        setFindReplaceOpen(true);
                        setTimeout(() => findInputRef.current?.focus(), 100);
                      }
                      if (key === 'history') {
                        if (selectedChapter) loadVersions(selectedChapter.id);
                        setHistoryOpen(true);
                      }
                    }}
                    items={[
                      { key: 'undo', icon: <Undo2 size={14} />, label: '撤回', disabled: undoStack.length === 0 },
                      { key: 'redo', icon: <Redo2 size={14} />, label: '前进', disabled: redoStack.length === 0 },
                      { type: 'divider' },
                      { key: 'format', icon: <Wand2 size={14} />, label: '一键排版' },
                      { key: 'spellcheck', icon: <SpellCheck size={14} />, label: '纠错字' },
                      { key: 'find', icon: <SearchIcon size={14} />, label: '查找 & 替换', },
                      { type: 'divider' },
                      { key: 'history', icon: <History size={14} />, label: '历史版本' },
                    ]}
                  />
                </motion.div>
              )}
              
              {/* 底部写作统计 */}
              {selectedChapter && !focusMode && (
                <div style={{
                  padding: '8px 24px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <Statistic title="本章字数" value={chapterWordCount} />
                    <Statistic title="本次新增" value={sessionWordCount} prefix="+" valueStyle={{ color: 'var(--success-color)', fontSize: 15, fontWeight: 600 }} />
                    <div style={{ padding: '0 18px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                      <Statistic title="写作目标" value={2000} prefix={<Target size={14} />} />
                    </div>
                    <Statistic title="进度" value={Math.min(100, Math.round(chapterWordCount / 2000 * 100))} suffix="%" valueStyle={{ color: 'var(--warning-color)', fontSize: 15, fontWeight: 600 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <span>提示: Ctrl+S 快速保存</span>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Empty
                image={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1360 1024" width={64} height={64} fill="none" style={{ color: 'var(--border-color)' }}><path fill="var(--primary-color)" d="M348.561 657.879c5.194 0 10.243-2.02 13.994-5.771 3.751-3.751 5.771-8.656 5.771-13.994V137.924c0-10.82-8.801-19.765-19.765-19.765-10.82 0-19.765 8.801-19.765 19.765v500.335c0 10.82 8.801 19.621 19.765 19.621z"/><path fill="var(--primary-color)" d="M1071.939 946.279L994.465 790.754l.721-445.511 155.236.289-.577 445.511-77.907 155.236zm-39.242-138.501l30.441 61.027h17.89l31.451-60.883m8.656-17.601l2.164-5.627.577-412.617-102.144-.289-.577 412.617 3.463 5.627M1149.846 328.507l-154.082-.289.144-111.522 154.082.289-.144 111.522zm-127.392-26.69l100.99.144.144-58.43-100.846-.144-.289 58.43z"/><path fill="var(--primary-color)" d="M1040.055 770.411l5.05-362.988 26.546.433-5.05 362.988-26.546-.433z"/><path fill="var(--text-tertiary)" d="M943.393 19.765c0-5.194-2.02-10.243-5.771-13.994-3.751-3.751-8.656-5.771-13.994-5.771H348.561c-86.419 0-133.884 47.61-133.884 133.884v677.356c-2.02 7.791-3.895 16.447-3.895 25.825 0 18.178 3.751 36.212 10.82 53.525l.144.433c.144.289.289.721.433 1.01l.144.144c6.204 17.89 14.86 31.307 27.844 43.714.866 2.02 2.164 4.04 3.751 5.627 7.214 7.214 16.591 12.263 26.979 15.437.577.144 1.154.433 1.731.577 10.243 3.029 21.641 4.616 34.048 4.616h470.633c5.194 0 10.243-2.02 13.994-5.771 3.751-3.751 5.771-8.656 5.771-13.994V19.765zM348.561 39.53h541.74v880.634H348.561c-10.243 0-19.329-1.154-27.263-3.318-6.926-1.876-12.696-4.904-17.313-8.945-.866-.866-1.587-1.731-2.308-2.741-9.231-10.821-14.86-26.258-14.86-44.725 0-6.493.866-12.696 2.453-18.466V134.024c0-70.558 32.462-94.498 95.939-94.498z"/><path fill="var(--text-tertiary)" d="M819.737 488.965H460.688c-10.82 0-19.765 8.801-19.765 19.765 0 10.82 8.801 19.765 19.765 19.765h359.049c10.82 0 19.765-8.801 19.765-19.765 0-10.965-8.945-19.765-19.765-19.765z"/><path fill="var(--text-tertiary)" d="M819.737 626.456H460.688c-10.82 0-19.765 8.801-19.765 19.765 0 10.82 8.801 19.765 19.765 19.765h359.049c10.82 0 19.765-8.801 19.765-19.765 0-10.965-8.945-19.765-19.765-19.765z"/><path fill="var(--text-tertiary)" d="M710.669 763.948H460.688c-10.82 0-19.765 8.801-19.765 19.765 0 10.82 8.801 19.765 19.765 19.765h249.981c10.82 0 19.765-8.801 19.765-19.765 0-10.965-8.945-19.765-19.765-19.765z"/><path fill="var(--primary-bg)" d="M819.737 229.628H460.688c-10.82 0-19.765 8.801-19.765 19.765v119.647c0 10.82 8.801 19.765 19.765 19.765h359.049c10.82 0 19.765-8.801 19.765-19.765V249.393c0-10.965-8.945-19.765-19.765-19.765z"/></svg>}
                description={<><span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>选择或创建一个章节开始写作</span><br/><span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>支持 Markdown 格式，有丰富的编辑功能</span></>}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleCreateVolume}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={16} />
                    新建卷
                  </button>
                  <button
                    onClick={() => handleCreateChapter()}
                    style={{
                      padding: '12px 28px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--primary-color)',
                      color: 'var(--text-inverse)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={16} />
                    新建章
                  </button>
                </div>
              </Empty>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 查找&替换弹窗 */}
        <AnimatePresence>
          {findReplaceOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: '20%',
                right: 40,
                zIndex: 9999,
                width: 450,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  查找 & 替换
                </span>
                <button
                  onClick={() => setFindReplaceOpen(false)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>查找</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      ref={findInputRef}
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      placeholder="查找内容..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 60 }}>
                      {findResults > 0 ? `${findCurrentIndex}/${findResults}` : '无结果'}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>替换为</label>
                  <input
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="替换为..."
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    onClick={handleReplaceOne}
                    disabled={findResults === 0}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: findResults > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      cursor: findResults > 0 ? 'pointer' : 'default',
                      fontSize: 13
                    }}
                  >
                    替换
                  </button>
                  <button
                    onClick={handleReplaceAll}
                    disabled={findResults === 0}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--primary-color)',
                      color: 'var(--text-inverse)',
                      cursor: findResults > 0 ? 'pointer' : 'default',
                      fontSize: 13,
                      fontWeight: 500
                    }}
                  >
                    全部替换
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 纠错字弹窗 */}
        <AnimatePresence>
          {spellCheckOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: '25%',
                right: 40,
                zIndex: 9999,
                width: 420,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  纠错字 {spellErrors.length > 0 && `(${spellErrors.length}处)`}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {spellErrors.length > 0 && (
                    <button
                      onClick={applyAllSpellFixes}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'var(--primary-color)',
                        color: 'var(--text-inverse)',
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      全部修正
                    </button>
                  )}
                  <button
                    onClick={() => { setSpellCheckOpen(false); setSpellErrors([]); }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              
              {spellErrors.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '16px 0', textAlign: 'center' }}>
                  未发现常见错别字
                </div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {spellErrors.map((error, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-secondary)',
                      fontSize: 13,
                      border: '1px solid var(--border-color)'
                    }}>
                      <span style={{ color: 'var(--error-color)', textDecoration: 'line-through', fontWeight: 500 }}>{error.text}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                      <span style={{ color: 'var(--success-color)', fontWeight: 500 }}>{error.suggestion}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => applySpellFix(error)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--primary-color)',
                          background: 'transparent',
                          color: 'var(--primary-color)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500
                        }}
                      >
                        修正
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 历史版本弹窗 */}
        <AnimatePresence>
          {historyOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: '30%',
                right: 40,
                zIndex: 9999,
                width: 420,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  历史版本
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    onClick={saveVersion}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--primary-color)',
                      color: 'var(--text-inverse)',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Save size={12} />
                    保存当前
                  </button>
                  <button
                    onClick={() => setHistoryOpen(false)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              
              {versions.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '16px 0', textAlign: 'center' }}>
                  暂无历史版本，点击"保存当前"创建
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <Timeline
                    items={versions.map((v, idx) => ({
                      color: idx === 0 ? 'blue' : 'gray',
                      children: (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 14 }}>
                              {new Date(v.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {v.wordCount} 字
                            </div>
                          </div>
                          <button
                            onClick={() => restoreVersion(v)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--primary-color)',
                              background: 'transparent',
                              color: 'var(--primary-color)',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 500
                            }}
                          >
                            恢复
                          </button>
                        </div>
                      ),
                    }))}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>
    </div>
  );
};

export default OutlineView;
