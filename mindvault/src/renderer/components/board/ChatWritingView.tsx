import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  BookOpen,
  Send,
  ImagePlus,
  Sparkles,
  FileText,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Download,
  Settings,
} from 'lucide-react';
import { Modal, Select, Tooltip, Dropdown, Spin, message as antMessage } from 'antd';
import ChatCharacterPanel from './ChatCharacterPanel';
import type { ChatCharacter, ChatMessage, ChatScene } from '@shared/types';

// ===== 类型定义 =====

interface ChatWritingViewProps {
  boardId: string;
  volumeId?: string;
}

type ViewMode = 'chat' | 'script';
type InputMode = 'dialogue' | 'narration';

// ===== 快速转化逻辑 =====

function quickConvert(
  messages: ChatMessage[],
  characters: ChatCharacter[],
  scenes: ChatScene[]
): string {
  let result = '';
  let currentScene = '';

  for (const msg of messages) {
    if (msg.type === 'narration') {
      result += msg.content + '\n\n';
      continue;
    }
    if (msg.type === 'system') continue;

    const char = characters.find((c) => c.id === msg.characterId);
    const charName = char?.name || '未知';

    // 检查场景切换
    const scene = scenes.find((s) => s.characters.includes(msg.characterId || ''));
    if (scene && scene.name !== currentScene) {
      currentScene = scene.name;
      result += `**${scene.name}**\n\n`;
    }

    // 对话转叙述
    result += `${charName}：${msg.content}\n\n`;
  }

  return result.trim();
}

// ===== 主组件 =====

const ChatWritingView: React.FC<ChatWritingViewProps> = ({ boardId, volumeId }) => {
  // ===== 数据状态 =====
  const [characters, setCharacters] = useState<ChatCharacter[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenes, setScenes] = useState<ChatScene[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [currentVolumeId, setCurrentVolumeId] = useState<string>('');
  const [currentSceneId, setCurrentSceneId] = useState<string>('');

  // ===== UI 状态 =====
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [inputMode, setInputMode] = useState<InputMode>('dialogue');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [showCharacterPanel, setShowCharacterPanel] = useState(true);
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // ===== 场景管理 Modal =====
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [sceneForm, setSceneForm] = useState({ name: '', description: '', characters: [] as string[] });

  // ===== 转化结果 Modal =====
  const [convertResult, setConvertResult] = useState('');
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  // ===== Refs =====
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ===== 数据加载 =====

  const loadCharacters = useCallback(async () => {
    try {
      const list = await window.electronAPI.chatRoom.characters.list(boardId);
      setCharacters(list || []);
      // 默认选中第一个人物
      if (list && list.length > 0 && !selectedCharacterId) {
        setSelectedCharacterId(list[0].id);
      }
    } catch (err) {
      console.error('[ChatWritingView] 加载人物失败:', err);
    }
  }, [boardId]);

  const loadVolumes = useCallback(async () => {
    try {
      const list = await window.electronAPI.writing.listVolumes(boardId);
      setVolumes(list || []);
      // 如果有 volumeId prop，使用它；否则使用第一个
      if (volumeId) {
        setCurrentVolumeId(volumeId);
      } else if (list && list.length > 0) {
        setCurrentVolumeId(list[0].id);
      }
    } catch (err) {
      console.error('[ChatWritingView] 加载卷列表失败:', err);
    }
  }, [boardId, volumeId]);

  const loadMessages = useCallback(async () => {
    if (!currentVolumeId) return;
    setLoading(true);
    try {
      const list = await window.electronAPI.chatRoom.messages.list(currentVolumeId);
      setMessages(list || []);
    } catch (err) {
      console.error('[ChatWritingView] 加载消息失败:', err);
    } finally {
      setLoading(false);
    }
  }, [currentVolumeId]);

  const loadScenes = useCallback(async () => {
    if (!currentVolumeId) return;
    try {
      const list = await window.electronAPI.chatRoom.scenes.list(currentVolumeId);
      setScenes(list || []);
    } catch (err) {
      console.error('[ChatWritingView] 加载场景失败:', err);
    }
  }, [currentVolumeId]);

  useEffect(() => {
    loadCharacters();
    loadVolumes();
  }, [loadCharacters, loadVolumes]);

  useEffect(() => {
    loadMessages();
    loadScenes();
  }, [loadMessages, loadScenes]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===== 消息操作 =====

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !currentVolumeId) return;

    try {
      const msgData: any = {
        boardId,
        volumeId: currentVolumeId,
        type: inputMode,
        content: inputText.trim(),
      };

      if (inputMode === 'dialogue') {
        if (!selectedCharacterId) {
          antMessage.warning('请先选择一个人物');
          return;
        }
        msgData.characterId = selectedCharacterId;
      }

      await window.electronAPI.chatRoom.messages.create(msgData);
      setInputText('');
      loadMessages();
    } catch (err) {
      console.error('[ChatWritingView] 发送消息失败:', err);
    }
  }, [inputText, inputMode, selectedCharacterId, currentVolumeId, boardId, loadMessages]);

  const handleDeleteMessage = useCallback(async (msgId: string) => {
    try {
      await window.electronAPI.chatRoom.messages.delete(msgId);
      loadMessages();
    } catch (err) {
      console.error('[ChatWritingView] 删除消息失败:', err);
    }
  }, [loadMessages]);

  const handleEditMessage = useCallback((msg: ChatMessage) => {
    setEditMessageId(msg.id);
    setEditText(msg.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editMessageId || !editText.trim()) return;
    try {
      await window.electronAPI.chatRoom.messages.update(editMessageId, {
        content: editText.trim(),
      });
      setEditMessageId(null);
      setEditText('');
      loadMessages();
    } catch (err) {
      console.error('[ChatWritingView] 更新消息失败:', err);
    }
  }, [editMessageId, editText, loadMessages]);

  // ===== 场景操作 =====

  const handleCreateScene = useCallback(async () => {
    if (!sceneForm.name.trim() || !currentVolumeId) return;
    try {
      await window.electronAPI.chatRoom.scenes.create({
        boardId,
        volumeId: currentVolumeId,
        name: sceneForm.name.trim(),
        description: sceneForm.description,
        characters: sceneForm.characters,
      });
      setSceneModalOpen(false);
      setSceneForm({ name: '', description: '', characters: [] });
      loadScenes();
    } catch (err) {
      console.error('[ChatWritingView] 创建场景失败:', err);
    }
  }, [sceneForm, boardId, currentVolumeId, loadScenes]);

  // ===== 转化操作 =====

  const handleQuickConvert = useCallback(() => {
    if (messages.length === 0) {
      antMessage.info('暂无消息可转化');
      return;
    }
    const result = quickConvert(messages, characters, scenes);
    setConvertResult(result);
    setConvertModalOpen(true);
  }, [messages, characters, scenes]);

  const handleAIConvert = useCallback(async () => {
    if (messages.length === 0) {
      antMessage.info('暂无消息可转化');
      return;
    }
    setConverting(true);
    try {
      const rawText = quickConvert(messages, characters, scenes);
      const prompt = `你是一位专业的编剧和小说编辑。请将以下对话记录转化为流畅的小说叙事文本。要求：
1. 保留所有对话内容，但将其自然融入叙事
2. 添加适当的动作描写、心理描写和环境描写
3. 保持人物性格和语气风格一致
4. 场景切换要自然流畅
5. 不要遗漏任何重要信息

原始对话：
${rawText}

请输出转化后的小说文本：`;

      const result = await window.electronAPI.ai.chat(
        [{ role: 'user', content: prompt }],
        {}
      );
      setConvertResult(result?.content || result || '');
      setConvertModalOpen(true);
    } catch (err) {
      console.error('[ChatWritingView] AI 转化失败:', err);
      antMessage.error('AI 转化失败，请检查 AI 设置');
    } finally {
      setConverting(false);
    }
  }, [messages, characters, scenes]);

  // ===== 图片插入（旁白模式） =====

  const handleInsertImage = useCallback(async () => {
    try {
      const filePath = await window.electronAPI.file.select({
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      });
      if (filePath) {
        // 将文件路径转为可访问的 URL
        const url = await window.electronAPI.media.getUrl(filePath);
        if (url) {
          if (currentVolumeId) {
            await window.electronAPI.chatRoom.messages.create({
              boardId,
              volumeId: currentVolumeId,
              type: 'narration',
              content: '',
              mediaUrl: url,
              mediaType: 'image',
            });
            loadMessages();
          }
        }
      }
    } catch (err) {
      console.error('[ChatWritingView] 插入图片失败:', err);
    }
  }, [boardId, currentVolumeId, loadMessages]);

  // ===== 键盘快捷键 =====

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // ===== 辅助函数 =====

  const getCharacter = (id: string) => characters.find((c) => c.id === id);

  // ===== 渲染：聊天消息 =====

  const renderChatMessage = (msg: ChatMessage) => {
    const char = msg.characterId ? getCharacter(msg.characterId) : null;

    // 旁白消息
    if (msg.type === 'narration') {
      return (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 20px',
          }}
        >
          <div
            onDoubleClick={() => handleEditMessage(msg)}
            style={{
              maxWidth: '80%',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              lineHeight: 1.6,
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            {msg.mediaUrl && msg.mediaType === 'image' && (
              <img
                src={msg.mediaUrl}
                alt="旁白图片"
                style={{
                  maxWidth: '100%',
                  maxHeight: 200,
                  borderRadius: 8,
                  marginBottom: 8,
                  objectFit: 'cover',
                }}
              />
            )}
            {msg.content && <span>{msg.content}</span>}
            {/* 操作按钮 */}
            <div style={{
              position: 'absolute',
              top: -8,
              right: -8,
              display: 'flex',
              gap: 2,
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
            >
              <Tooltip title="删除">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDeleteMessage(msg.id)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'var(--error-color)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={10} />
                </motion.button>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      );
    }

    // 系统消息
    if (msg.type === 'system') {
      return (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '6px 20px',
          }}
        >
          <div style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            border: '1px dashed var(--border-color)',
            borderRadius: 8,
            padding: '4px 14px',
            background: 'var(--bg-secondary)',
          }}>
            {msg.content}
          </div>
        </motion.div>
      );
    }

    // 对话消息
    const isEditing = editMessageId === msg.id;
    const isOwn = true; // 聊天室模式下都是自己的消息

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          display: 'flex',
          gap: 10,
          padding: '8px 20px',
          alignItems: 'flex-start',
        }}
      >
        {/* 头像 */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: char?.color || '#667eea',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
          boxShadow: `0 2px 8px ${char?.color || '#667eea'}44`,
        }}>
          {char?.avatar || '👤'}
        </div>

        {/* 消息体 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 名字 */}
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: char?.color || 'var(--text-secondary)',
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {char?.name || '未知'}
            <span style={{
              fontSize: 10,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
            }}>
              {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* 气泡 */}
          {isEditing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--primary-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  outline: 'none',
                  resize: 'none',
                  minHeight: 40,
                  fontFamily: 'inherit',
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    setEditMessageId(null);
                  }
                }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSaveEdit}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: 'var(--primary-color)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                保存
              </motion.button>
            </div>
          ) : (
            <motion.div
              onDoubleClick={() => handleEditMessage(msg)}
              style={{
                display: 'inline-block',
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: '4px 16px 16px 16px',
                backgroundColor: char?.color
                  ? `${char.color}18`
                  : 'var(--bg-tertiary)',
                borderLeft: `3px solid ${char?.color || 'var(--primary-color)'}`,
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                wordBreak: 'break-word',
                position: 'relative',
              }}
              whileHover={{ scale: 1.01 }}
            >
              {msg.content}
              {/* 悬浮操作 */}
              <div
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  display: 'flex',
                  gap: 2,
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
                className="msg-actions"
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
              >
                <Tooltip title="编辑">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleEditMessage(msg)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Edit3 size={10} />
                  </motion.button>
                </Tooltip>
                <Tooltip title="删除">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDeleteMessage(msg.id)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'var(--error-color)',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={10} />
                  </motion.button>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  // ===== 渲染：剧本视图 =====

  const renderScriptMessage = (msg: ChatMessage, index: number) => {
    const char = msg.characterId ? getCharacter(msg.characterId) : null;

    if (msg.type === 'system') return null;

    if (msg.type === 'narration') {
      return (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '4px 24px',
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          {msg.mediaUrl && msg.mediaType === 'image' && (
            <img
              src={msg.mediaUrl}
              alt="场景图片"
              style={{
                maxWidth: 300,
                maxHeight: 180,
                borderRadius: 6,
                marginBottom: 6,
                objectFit: 'cover',
              }}
            />
          )}
          {msg.content && `（旁白：${msg.content}）`}
        </motion.div>
      );
    }

    // 对话 - 剧本格式
    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          padding: '6px 24px',
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        <span style={{
          color: char?.color || 'var(--text-primary)',
          fontWeight: 600,
        }}>
          {char?.name || '未知'}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>：</span>
        <span style={{ color: 'var(--text-primary)' }}>
          {msg.content}
        </span>
      </motion.div>
    );
  };

  // ===== 渲染：空状态 =====

  const renderEmptyState = () => (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-tertiary)',
      gap: 12,
    }}>
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <MessageSquare size={48} style={{ opacity: 0.2 }} />
      </motion.div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>开始你的对话创作</div>
      <div style={{ fontSize: 12, maxWidth: 300, textAlign: 'center', lineHeight: 1.6 }}>
        在左侧面板添加人物，选择人物后开始对话。使用旁白模式可以添加场景描写。
      </div>
    </div>
  );

  // ===== 主渲染 =====

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }}>
      {/* ===== 顶栏 ===== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        {/* 左侧：面板切换 + 场景选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tooltip title={showCharacterPanel ? '收起人物面板' : '展开人物面板'}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowCharacterPanel(!showCharacterPanel)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {showCharacterPanel ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </motion.button>
          </Tooltip>

          {/* 卷选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>卷：</span>
            <select
              value={currentVolumeId}
              onChange={(e) => setCurrentVolumeId(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {volumes.length === 0 && <option value="">无卷</option>}
              {volumes.map((v: any) => (
                <option key={v.id} value={v.id}>{v.title || '未命名卷'}</option>
              ))}
            </select>
          </div>

          {/* 场景选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>场景：</span>
            <select
              value={currentSceneId}
              onChange={(e) => setCurrentSceneId(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
                maxWidth: 140,
              }}
            >
              <option value="">全部场景</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Tooltip title="新建场景">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setSceneForm({ name: '', description: '', characters: [] });
                  setSceneModalOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  borderRadius: 4,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                }}
              >
                <Plus size={14} />
              </motion.button>
            </Tooltip>
          </div>
        </div>

        {/* 中间：视图切换 */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 8,
          padding: 2,
          gap: 2,
        }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode('chat')}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: viewMode === 'chat' ? 'var(--primary-color)' : 'transparent',
              color: viewMode === 'chat' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
          >
            <MessageSquare size={13} />
            聊天
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode('script')}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: viewMode === 'script' ? 'var(--primary-color)' : 'transparent',
              color: viewMode === 'script' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
          >
            <ScrollText size={13} />
            剧本
          </motion.button>
        </div>

        {/* 右侧：转化按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tooltip title="快速转化（规则转化）">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleQuickConvert}
              disabled={messages.length === 0}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: messages.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                cursor: messages.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <FileText size={13} />
              快速转化
            </motion.button>
          </Tooltip>
          <Tooltip title="AI 精修（AI 转化）">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAIConvert}
              disabled={messages.length === 0 || converting}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: converting
                  ? 'var(--bg-tertiary)'
                  : 'linear-gradient(135deg, var(--primary-color), #a855f7)',
                color: '#fff',
                cursor: messages.length > 0 && !converting ? 'pointer' : 'not-allowed',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {converting ? (
                <Spin size={12} />
              ) : (
                <Sparkles size={13} />
              )}
              AI 精修
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {/* ===== 主体区域 ===== */}
      <div style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* 人物面板 */}
        <AnimatePresence>
          {showCharacterPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <ChatCharacterPanel
                boardId={boardId}
                onSelectCharacter={setSelectedCharacterId}
                selectedCharacterId={selectedCharacterId}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 消息区域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* 消息列表 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 0',
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}>
                <Spin />
              </div>
            ) : messages.length === 0 ? (
              renderEmptyState()
            ) : viewMode === 'chat' ? (
              messages.map(renderChatMessage)
            ) : (
              <div style={{ paddingBottom: 20 }}>
                {/* 剧本视图头部 */}
                {currentSceneId && (() => {
                  const scene = scenes.find((s) => s.id === currentSceneId);
                  if (scene) {
                    return (
                      <div style={{
                        padding: '12px 24px 8px',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-light)',
                        marginBottom: 8,
                      }}>
                        【场景：{scene.name}{scene.description ? ` - ${scene.description}` : ''}】
                      </div>
                    );
                  }
                  return null;
                })()}
                {messages.map(renderScriptMessage)}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ===== 底栏 ===== */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            flexShrink: 0,
          }}>
            {/* 人物选择器 */}
            <div style={{ flexShrink: 0 }}>
              <select
                value={inputMode === 'dialogue' ? selectedCharacterId : '__narration__'}
                onChange={(e) => {
                  if (e.target.value === '__narration__') {
                    setInputMode('narration');
                  } else {
                    setInputMode('dialogue');
                    setSelectedCharacterId(e.target.value);
                  }
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  backgroundColor: inputMode === 'narration' ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  color: inputMode === 'narration'
                    ? 'var(--text-tertiary)'
                    : (getCharacter(selectedCharacterId)?.color || 'var(--text-primary)'),
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer',
                  minWidth: 100,
                  fontWeight: 500,
                }}
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.avatar} {c.name}
                  </option>
                ))}
                <option value="__narration__">📝 旁白</option>
              </select>
            </div>

            {/* 输入框 */}
            <div style={{
              flex: 1,
              position: 'relative',
            }}>
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  inputMode === 'narration'
                    ? '输入旁白描述... (Ctrl+Enter 发送)'
                    : selectedCharacterId
                      ? `以 ${getCharacter(selectedCharacterId)?.name || ''} 的身份说话... (Ctrl+Enter 发送)`
                      : '请先选择一个人物...'
                }
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  outline: 'none',
                  resize: 'none',
                  minHeight: 38,
                  maxHeight: 120,
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                rows={1}
              />
              <div style={{
                position: 'absolute',
                bottom: 6,
                right: 8,
                fontSize: 10,
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }}>
                Ctrl+Enter
              </div>
            </div>

            {/* 旁白图片按钮 */}
            {inputMode === 'narration' && (
              <Tooltip title="插入图片">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleInsertImage}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ImagePlus size={16} />
                </motion.button>
              </Tooltip>
            )}

            {/* 发送按钮 */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: 'none',
                background: inputText.trim()
                  ? 'linear-gradient(135deg, var(--primary-color), #a855f7)'
                  : 'var(--bg-tertiary)',
                color: inputText.trim() ? '#fff' : 'var(--text-tertiary)',
                cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={16} />
            </motion.button>
          </div>
        </div>

        {/* 便利签引用面板（可选） */}
        <AnimatePresence>
          {showRefPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                width: 200,
                minWidth: 200,
                borderLeft: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div style={{
                padding: '12px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span>便利签引用</span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowRefPanel(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                  }}
                >
                  <PanelLeftClose size={14} />
                </motion.button>
              </div>
              <div style={{
                padding: 12,
                color: 'var(--text-tertiary)',
                fontSize: 12,
                textAlign: 'center',
              }}>
                拖拽创意卡片到此处作为写作参考
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== 场景创建 Modal ===== */}
      <Modal
        title="新建场景"
        open={sceneModalOpen}
        onOk={handleCreateScene}
        onCancel={() => setSceneModalOpen(false)}
        okText="创建"
        cancelText="取消"
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              场景名称 *
            </label>
            <input
              value={sceneForm.name}
              onChange={(e) => setSceneForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="如：咖啡厅 - 下午三点"
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              场景描述
            </label>
            <textarea
              value={sceneForm.description}
              onChange={(e) => setSceneForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="描述场景的环境、氛围等"
              rows={2}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              在场人物
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {characters.map((c) => {
                const isSelected = sceneForm.characters.includes(c.id);
                return (
                  <motion.button
                    key={c.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSceneForm((f) => ({
                        ...f,
                        characters: isSelected
                          ? f.characters.filter((id) => id !== c.id)
                          : [...f.characters, c.id],
                      }));
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 14,
                      border: `1px solid ${isSelected ? c.color : 'var(--border-color)'}`,
                      backgroundColor: isSelected ? `${c.color}22` : 'transparent',
                      color: isSelected ? c.color : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {c.avatar} {c.name}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* ===== 转化结果 Modal ===== */}
      <Modal
        title={converting ? 'AI 精修中...' : '转化结果'}
        open={convertModalOpen}
        onCancel={() => setConvertModalOpen(false)}
        width={640}
        footer={[
          <motion.button
            key="copy"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              navigator.clipboard.writeText(convertResult).then(() => {
                antMessage.success('已复制到剪贴板');
              });
            }}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Copy size={14} />
            复制
          </motion.button>,
          <motion.button
            key="close"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setConvertModalOpen(false)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            关闭
          </motion.button>,
        ]}
      >
        {converting ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 0',
            gap: 12,
          }}>
            <Spin size="large" />
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
              AI 正在精修你的对话...
            </div>
          </div>
        ) : (
          <div style={{
            maxHeight: 500,
            overflowY: 'auto',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.8,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
          }}>
            {convertResult}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChatWritingView;
