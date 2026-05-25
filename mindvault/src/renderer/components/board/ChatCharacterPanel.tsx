import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Edit3,
  Trash2,
  Users,
  ChevronRight,
  X,
  Link2,
} from 'lucide-react';
import { Modal, Input, Popover, Dropdown, Tooltip, ColorPicker, Empty } from 'antd';
import type { ChatCharacter, ChatCharacterRelation } from '@shared/types';

// ===== 类型定义 =====

interface ChatCharacterPanelProps {
  boardId: string;
  onSelectCharacter?: (characterId: string) => void;
  selectedCharacterId?: string | null;
}

interface CharacterFormData {
  name: string;
  avatar: string;
  personality: string;
  speechStyle: string;
  color: string;
}

const DEFAULT_EMOJIS = [
  '👤', '👩', '👨', '👧', '👦', '🧑', '👱', '👴', '👵',
  '🧔', '👸', '🤴', '🧙', '🧚', '🦸', '🦹', '🧛', '🧜',
  '🧝', '🧞', '🧟', '👻', '🤖', '👽', '🐱', '🐶', '🦊',
];

const DEFAULT_COLORS = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
  '#fee140', '#a18cd1', '#fbc2eb', '#84fab0', '#8fd3f4',
  '#ff9a9e', '#fad0c4', '#ffecd2', '#fcb69f', '#a1c4fd',
];

const RELATION_TYPES = [
  { value: 'friend', label: '朋友' },
  { value: 'lover', label: '恋人' },
  { value: 'family', label: '家人' },
  { value: 'colleague', label: '同事' },
  { value: 'rival', label: '对手' },
  { value: 'mentor', label: '师徒' },
  { value: 'superior', label: '上下级' },
  { value: 'stranger', label: '陌生人' },
  { value: 'enemy', label: '敌人' },
  { value: 'custom', label: '自定义' },
];

// ===== 主组件 =====

const ChatCharacterPanel: React.FC<ChatCharacterPanelProps> = ({
  boardId,
  onSelectCharacter,
  selectedCharacterId,
}) => {
  const [characters, setCharacters] = useState<ChatCharacter[]>([]);
  const [relations, setRelations] = useState<ChatCharacterRelation[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal 状态
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<ChatCharacter | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    avatar: '👤',
    personality: '',
    speechStyle: '',
    color: '#667eea',
  });

  // 关系 Modal
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationForm, setRelationForm] = useState({
    characterAId: '',
    characterBId: '',
    relationType: 'friend',
    description: '',
  });

  // ===== 数据加载 =====

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.chatRoom.characters.list(boardId);
      setCharacters(list || []);
    } catch (err) {
      console.error('[ChatCharacterPanel] 加载人物失败:', err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const loadRelations = useCallback(async () => {
    try {
      const list = await window.electronAPI.chatRoom.relations.list(boardId);
      setRelations(list || []);
    } catch (err) {
      console.error('[ChatCharacterPanel] 加载关系失败:', err);
    }
  }, [boardId]);

  useEffect(() => {
    loadCharacters();
    loadRelations();
  }, [loadCharacters, loadRelations]);

  // ===== 人物 CRUD =====

  const handleAddCharacter = () => {
    setEditingCharacter(null);
    setFormData({
      name: '',
      avatar: '👤',
      personality: '',
      speechStyle: '',
      color: '#667eea',
    });
    setModalOpen(true);
  };

  const handleEditCharacter = (char: ChatCharacter) => {
    setEditingCharacter(char);
    setFormData({
      name: char.name,
      avatar: char.avatar || '👤',
      personality: char.personality || '',
      speechStyle: char.speechStyle || '',
      color: char.color || '#667eea',
    });
    setModalOpen(true);
  };

  const handleSaveCharacter = async () => {
    if (!formData.name.trim()) return;

    try {
      if (editingCharacter) {
        await window.electronAPI.chatRoom.characters.update(editingCharacter.id, {
          name: formData.name.trim(),
          avatar: formData.avatar,
          personality: formData.personality,
          speechStyle: formData.speechStyle,
          color: formData.color,
        });
      } else {
        await window.electronAPI.chatRoom.characters.create({
          boardId,
          name: formData.name.trim(),
          avatar: formData.avatar,
          personality: formData.personality,
          speechStyle: formData.speechStyle,
          color: formData.color,
        });
      }
      setModalOpen(false);
      loadCharacters();
    } catch (err) {
      console.error('[ChatCharacterPanel] 保存人物失败:', err);
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    try {
      await window.electronAPI.chatRoom.characters.delete(charId);
      loadCharacters();
      loadRelations();
    } catch (err) {
      console.error('[ChatCharacterPanel] 删除人物失败:', err);
    }
  };

  // ===== 关系 CRUD =====

  const handleAddRelation = () => {
    if (characters.length < 2) return;
    setRelationForm({
      characterAId: characters[0]?.id || '',
      characterBId: characters[1]?.id || '',
      relationType: 'friend',
      description: '',
    });
    setRelationModalOpen(true);
  };

  const handleSaveRelation = async () => {
    if (!relationForm.characterAId || !relationForm.characterBId) return;
    if (relationForm.characterAId === relationForm.characterBId) return;

    try {
      await window.electronAPI.chatRoom.relations.create({
        boardId,
        characterAId: relationForm.characterAId,
        characterBId: relationForm.characterBId,
        relationType: relationForm.relationType,
        description: relationForm.description,
      });
      setRelationModalOpen(false);
      loadRelations();
    } catch (err) {
      console.error('[ChatCharacterPanel] 保存关系失败:', err);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    try {
      await window.electronAPI.chatRoom.relations.delete(relationId);
      loadRelations();
    } catch (err) {
      console.error('[ChatCharacterPanel] 删除关系失败:', err);
    }
  };

  // ===== 辅助函数 =====

  const getCharacterName = (id: string) => {
    const char = characters.find((c) => c.id === id);
    return char?.name || '未知';
  };

  const getCharacterColor = (id: string) => {
    const char = characters.find((c) => c.id === id);
    return char?.color || '#667eea';
  };

  const getRelationLabel = (type: string) => {
    const found = RELATION_TYPES.find((r) => r.value === type);
    return found?.label || type;
  };

  // ===== 人物右键菜单 =====

  const getCharacterMenuItems = (char: ChatCharacter) => [
    {
      key: 'edit',
      label: '编辑人物',
      icon: <Edit3 size={14} />,
      onClick: () => handleEditCharacter(char),
    },
    {
      key: 'delete',
      label: '删除人物',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: () => handleDeleteCharacter(char.id),
    },
  ];

  // ===== 渲染 =====

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      overflow: 'hidden',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 12px 8px',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          <Users size={15} />
          人物
          <span style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontWeight: 400,
          }}>
            ({characters.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title="添加人物">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddCharacter}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={15} />
            </motion.button>
          </Tooltip>
          <Tooltip title="添加关系">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddRelation}
              disabled={characters.length < 2}
              style={{
                background: 'none',
                border: 'none',
                cursor: characters.length >= 2 ? 'pointer' : 'not-allowed',
                padding: 4,
                borderRadius: 6,
                color: characters.length >= 2 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Link2 size={15} />
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {/* 人物列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '6px 8px',
      }}>
        <AnimatePresence>
          {characters.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              gap: 8,
            }}>
              <Users size={28} style={{ opacity: 0.3 }} />
              <span>暂无人物</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddCharacter}
                style={{
                  background: 'var(--primary-color)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <UserPlus size={12} />
                添加人物
              </motion.button>
            </div>
          ) : (
            characters.map((char, index) => (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: index * 0.03 }}
              >
                <Dropdown
                  menu={{ items: getCharacterMenuItems(char) }}
                  trigger={['contextMenu']}
                >
                  <motion.div
                    whileHover={{ backgroundColor: 'var(--bg-tertiary)' }}
                    onClick={() => onSelectCharacter?.(char.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      borderLeft: selectedCharacterId === char.id
                        ? `3px solid ${char.color || 'var(--primary-color)'}`
                        : '3px solid transparent',
                      backgroundColor: selectedCharacterId === char.id
                        ? 'var(--bg-tertiary)'
                        : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* 头像 */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: char.color || '#667eea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                      boxShadow: `0 2px 6px ${char.color || '#667eea'}33`,
                    }}>
                      {char.avatar || '👤'}
                    </div>

                    {/* 名字 */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {char.name}
                      </div>
                      {char.personality && (
                        <div style={{
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 1,
                        }}>
                          {char.personality}
                        </div>
                      )}
                    </div>

                    {/* 颜色指示 */}
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: char.color || '#667eea',
                      flexShrink: 0,
                    }} />
                  </motion.div>
                </Dropdown>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 关系列表 */}
      {relations.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border-light)',
          maxHeight: 140,
          overflowY: 'auto',
          padding: '8px 12px',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Link2 size={11} />
            人物关系
          </div>
          {relations.map((rel) => (
            <div
              key={rel.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 0',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ color: getCharacterColor(rel.characterAId), fontWeight: 500 }}>
                {getCharacterName(rel.characterAId)}
              </span>
              <ChevronRight size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <span
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                }}
              >
                {getRelationLabel(rel.relationType)}
              </span>
              <ChevronRight size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <span style={{ color: getCharacterColor(rel.characterBId), fontWeight: 500 }}>
                {getCharacterName(rel.characterBId)}
              </span>
              <motion.button
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleDeleteRelation(rel.id)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                <X size={10} />
              </motion.button>
            </div>
          ))}
        </div>
      )}

      {/* ===== 人物编辑 Modal ===== */}
      <Modal
        title={editingCharacter ? '编辑人物' : '添加人物'}
        open={modalOpen}
        onOk={handleSaveCharacter}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={440}
        styles={{
          body: { padding: '16px 24px' },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 名字 + 头像 */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                人物名字 *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="输入人物名字"
                style={{ borderRadius: 8 }}
                maxLength={20}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                头像
              </label>
              <Popover
                content={
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                    maxWidth: 260,
                  }}>
                    {DEFAULT_EMOJIS.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setFormData((f) => ({ ...f, avatar: emoji }))}
                        style={{
                          fontSize: 20,
                          background: formData.avatar === emoji ? 'var(--primary-light)' : 'transparent',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          padding: 4,
                          lineHeight: 1,
                        }}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                }
                trigger="click"
                placement="bottom"
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: formData.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  cursor: 'pointer',
                  border: '2px solid var(--border-color)',
                  transition: 'border-color 0.2s',
                }}>
                  {formData.avatar}
                </div>
              </Popover>
            </div>
          </div>

          {/* 颜色选择 */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              角色颜色
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEFAULT_COLORS.map((color) => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setFormData((f) => ({ ...f, color }))}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: formData.color === color
                      ? '2px solid var(--text-primary)'
                      : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: formData.color === color
                      ? `0 0 0 2px var(--bg-primary), 0 0 8px ${color}66`
                      : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
              <ColorPicker
                value={formData.color}
                onChange={(_, hex) => setFormData((f) => ({ ...f, color: hex }))}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: '2px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                }}>
                  +
                </div>
              </ColorPicker>
            </div>
          </div>

          {/* 性格描述 */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              性格描述
            </label>
            <Input.TextArea
              value={formData.personality}
              onChange={(e) => setFormData((f) => ({ ...f, personality: e.target.value }))}
              placeholder="描述人物的性格特征，如：冷静、理性、偶尔幽默"
              rows={2}
              style={{ borderRadius: 8, resize: 'none' }}
              maxLength={200}
            />
          </div>

          {/* 语气风格 */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              语气风格
            </label>
            <Input.TextArea
              value={formData.speechStyle}
              onChange={(e) => setFormData((f) => ({ ...f, speechStyle: e.target.value }))}
              placeholder="描述人物的说话方式，如：喜欢用反问句、说话简短有力"
              rows={2}
              style={{ borderRadius: 8, resize: 'none' }}
              maxLength={200}
            />
          </div>
        </div>
      </Modal>

      {/* ===== 关系编辑 Modal ===== */}
      <Modal
        title="添加人物关系"
        open={relationModalOpen}
        onOk={handleSaveRelation}
        onCancel={() => setRelationModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              人物 A
            </label>
            <select
              value={relationForm.characterAId}
              onChange={(e) => setRelationForm((f) => ({ ...f, characterAId: e.target.value }))}
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
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              人物 B
            </label>
            <select
              value={relationForm.characterBId}
              onChange={(e) => setRelationForm((f) => ({ ...f, characterBId: e.target.value }))}
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
            >
              {characters
                .filter((c) => c.id !== relationForm.characterAId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              关系类型
            </label>
            <select
              value={relationForm.relationType}
              onChange={(e) => setRelationForm((f) => ({ ...f, relationType: e.target.value }))}
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
            >
              {RELATION_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              关系描述（可选）
            </label>
            <Input.TextArea
              value={relationForm.description}
              onChange={(e) => setRelationForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="补充描述这段关系"
              rows={2}
              style={{ borderRadius: 8, resize: 'none' }}
              maxLength={200}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChatCharacterPanel;
