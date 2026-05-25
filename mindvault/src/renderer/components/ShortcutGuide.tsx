import React, { useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from 'antd';

interface ShortcutGuideProps {
  onClose: () => void;
}

interface ShortcutItem {
  name: string;
  keys: string[];
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '通用',
    shortcuts: [
      { name: '关闭弹窗/对话框', keys: ['Escape'] },
    ],
  },
  {
    title: '导航',
    shortcuts: [
      { name: '搜索', keys: ['Ctrl', 'K'] },
      { name: '首页', keys: ['Ctrl', '1'] },
      { name: '设置', keys: ['Ctrl', ','] },
    ],
  },
  {
    title: '快捷操作',
    shortcuts: [
      { name: '快速录入', keys: ['Ctrl', 'Shift', 'N'] },
      { name: '快捷键速查', keys: ['Ctrl', '/'] },
    ],
  },
];

/** kbd 样式按键组件 */
const Kbd: React.FC<{ children: string }> = ({ children }) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 24,
      height: 24,
      padding: '0 6px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'var(--font-family)',
      border: '1px solid var(--border-color)',
      boxShadow: '0 1px 0 var(--border-color)',
      lineHeight: 1,
    }}
  >
    {children}
  </kbd>
);

const ShortcutGuide: React.FC<ShortcutGuideProps> = ({ onClose }) => {
  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <Modal
      open={true}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Keyboard size={18} color="var(--primary-color)" />
          </div>
          快捷键速查
        </div>
      }
      footer={null}
      centered
      width={520}
    >
      <div style={{ maxHeight: '60vh', overflow: 'auto', padding: '16px 24px 24px' }}>
          {SHORTCUT_GROUPS.map((group, groupIndex) => (
            <div key={group.title} style={{ marginBottom: groupIndex < SHORTCUT_GROUPS.length - 1 ? 20 : 0 }}>
              <h3 style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 10,
                paddingLeft: 2,
              }}>
                {group.title}
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-primary)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-primary)';
                    }}
                  >
                    <span style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text-primary)',
                    }}>
                      {shortcut.name}
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={key}>
                          {keyIndex > 0 && (
                            <span style={{
                              fontSize: 11,
                              color: 'var(--text-tertiary)',
                              margin: '0 2px',
                            }}>
                              +
                            </span>
                          )}
                          <Kbd>{key}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
  );
};

export default ShortcutGuide;
