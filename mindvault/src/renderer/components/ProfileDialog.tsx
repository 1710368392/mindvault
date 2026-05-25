import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check } from 'lucide-react';
import { Modal } from 'antd';
import { useSettingsStore } from '../stores/settingsStore';
import UserAvatar from './common/UserAvatar';
import ImageCropper from './common/ImageCropper';

interface ProfileDialogProps {
  onClose: () => void;
}

const PRESET_AVATARS = [
  { id: 'ragdoll', src: 'images/avatars/ragdoll.svg' },
  { id: 'siamese', src: 'images/avatars/siamese.svg' },
  { id: 'tabby', src: 'images/avatars/tabby.svg' },
  { id: 'persian', src: 'images/avatars/persian.svg' },
  { id: 'garden', src: 'images/avatars/garden.svg' },
  { id: 'maine', src: 'images/avatars/maine.svg' },
  { id: 'shorthair', src: 'images/avatars/shorthair.svg' },
  { id: 'special-forces', src: 'images/avatars/ArcticonsSpecialforcesgroup2.svg' },
  { id: 'special-forces-3', src: 'images/avatars/ArcticonsSpecialforcesgroup3.svg' },
  { id: 'ai', src: 'images/avatars/TokenBrandedImgnai.svg' },
  { id: 'omnom', src: 'images/avatars/TokenBrandedOmnom.svg' },
];

const ProfileDialog: React.FC<ProfileDialogProps> = ({ onClose }) => {
  const settings = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);

  const [nickname, setNickname] = useState(settings.nickname);
  const [avatar, setAvatar] = useState<string | null>(settings.avatar);
  const [signature, setSignature] = useState(settings.signature);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    saveSettings({
      nickname: nickname.trim() || '用户',
      avatar,
      signature: signature.trim(),
    });
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return; // 限制5MB

    // 打开裁剪弹窗
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedImage(ev.target?.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 处理裁剪完成
  const handleCropComplete = (croppedImage: string) => {
    setAvatar(croppedImage);
    setCropperOpen(false);
    setSelectedImage('');
    setShowAvatarPicker(false);
  };

  return (
    <Modal
      open={true}
      onCancel={onClose}
      title="个人资料"
      footer={null}
      centered
      width={420}
    >
      <div style={{
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
          <div
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            style={{
              position: 'relative',
              width: 80,
              height: 80,
              borderRadius: '50%',
              overflow: 'hidden',
              marginBottom: 16,
              cursor: 'pointer',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(108, 99, 255, 0.2)',
              border: '2px solid var(--border-light)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-color)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(108, 99, 255, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(108, 99, 255, 0.2)';
            }}
          >
            <UserAvatar size={80} avatar={avatar} nickname={nickname} />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 26,
              backgroundColor: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Camera size={12} color="#fff" />
            </div>
          </div>

          <AnimatePresence>
            {showAvatarPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: '100%',
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    marginBottom: 8,
                    fontWeight: 600,
                  }}>
                    选择预设头像
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 10,
                  }}>
                    {PRESET_AVATARS.map((item) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setAvatar(`svg:${item.src}`);
                          setShowAvatarPicker(false);
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: avatar === `svg:${item.src}` ? 'var(--primary-bg)' : 'var(--bg-tertiary)',
                          border: avatar === `svg:${item.src}` ? '2px solid var(--primary-color)' : '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s, border-color 0.15s',
                          overflow: 'hidden',
                        }}
                      >
                        <img src={item.src} alt={item.id} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                      </motion.div>
                    ))}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: 8,
                  }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      上传图片
                    </motion.button>
                    {avatar && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setAvatar(null);
                          setShowAvatarPicker(false);
                        }}
                        style={{
                          height: 32,
                          padding: '0 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-tertiary)',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        重置
                      </motion.button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ width: '100%', marginBottom: 14 }}>
            <label style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              marginBottom: 6,
              display: 'block',
            }}>
              昵称
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="输入你的昵称"
              maxLength={20}
              style={{
                width: '100%',
                height: 40,
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-bg)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ width: '100%', marginBottom: 24 }}>
            <label style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              marginBottom: 6,
              display: 'block',
            }}>
              个性签名
            </label>
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="写点什么介绍自己吧..."
              maxLength={50}
              style={{
                width: '100%',
                height: 40,
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-bg)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: 10,
            width: '100%',
          }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              取消
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)',
              }}
            >
              <Check size={16} />
              保存
            </motion.button>
          </div>
        </div>

        {/* 图片裁剪弹窗 */}
        <ImageCropper
          open={cropperOpen}
          image={selectedImage}
          onCrop={handleCropComplete}
          onCancel={() => {
            setCropperOpen(false);
            setSelectedImage('');
          }}
        />
    </Modal>
  );
};

export default ProfileDialog;
