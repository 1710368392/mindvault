import React, { useState, useCallback } from 'react';
import { Lock, Sparkles, Unlock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from 'antd';
import { useSettingsStore } from '../stores/settingsStore';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mindvault-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface PrivacyLockProps {
  onUnlock: () => void;
  noPassword?: boolean;
}

const PrivacyLock: React.FC<PrivacyLockProps> = ({ onUnlock, noPassword }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const privacyPassword = useSettingsStore((s) => s.settings.privacyPassword);
  const privacyMaxAttempts = useSettingsStore((s) => s.settings.privacyMaxAttempts);
  const privacyLockoutMinutes = useSettingsStore((s) => s.settings.privacyLockoutMinutes);
  const privacyShowHint = useSettingsStore((s) => s.settings.privacyShowHint);
  const privacyHint = useSettingsStore((s) => s.settings.privacyHint);

  const handleUnlock = useCallback(async () => {
    if (noPassword) {
      onUnlock();
      return;
    }

    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 60000);
      setError(`尝试次数过多，请 ${remaining} 分钟后再试`);
      return;
    }

    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const hashed = await hashPassword(password);

      if (hashed === privacyPassword) {
        setAttempts(0);
        setLockoutUntil(null);
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);

        if (privacyMaxAttempts > 0 && newAttempts >= privacyMaxAttempts) {
          setLockoutUntil(Date.now() + privacyLockoutMinutes * 60000);
          setError(`密码错误次数过多，已锁定 ${privacyLockoutMinutes} 分钟`);
        } else {
          const remaining = privacyMaxAttempts > 0 ? privacyMaxAttempts - newAttempts : 0;
          setError(remaining > 0 ? `密码错误，还可尝试 ${remaining} 次` : '密码错误，请重试');
        }
      }
    } catch {
      setError('验证失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [password, privacyPassword, onUnlock, noPassword, attempts, lockoutUntil, privacyMaxAttempts, privacyLockoutMinutes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleUnlock();
      }
    },
    [handleUnlock]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background:
          'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-tertiary) 50%, var(--bg-primary) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'var(--primary-bg)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-5%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'var(--primary-bg)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          x: isShaking ? [0, -10, 10, -6, 6, 0] : 0,
        }}
        transition={
          isShaking
            ? { x: { duration: 0.5 } }
            : { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
        }
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-xl)',
          padding: '40px 32px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          border: '1px solid var(--border-color)',
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px var(--color-primary-glow, rgba(108, 99, 255, 0.25))',
          }}
        >
          {noPassword ? <Unlock size={32} color="#fff" strokeWidth={2} /> : <Lock size={32} color="#fff" strokeWidth={2} />}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={20} color="var(--primary-color)" />
            脑洞集
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            {noPassword ? '应用已锁定，点击解锁' : '请输入密码以解锁应用'}
          </div>
        </motion.div>

        {!noPassword && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            style={{
              width: '100%',
              position: 'relative',
            }}
          >
            <Input.Password
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="请输入密码"
              autoFocus
              status={error ? 'error' : undefined}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                fontSize: 15,
              }}
            />
          </motion.div>
        )}

        {!noPassword && privacyShowHint && privacyHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            💡 提示：{privacyHint}
          </motion.div>
        )}

        {!noPassword && (
          <motion.div
            initial={false}
            animate={{
              opacity: error ? 1 : 0,
              height: error ? 20 : 0,
              marginBottom: error ? -8 : 0,
            }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: 13,
              color: 'var(--error-color)',
              textAlign: 'center',
              overflow: 'hidden',
              lineHeight: '20px',
            }}
          >
            {error}
          </motion.div>
        )}

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: noPassword ? 0.4 : 0.5, duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUnlock}
          disabled={isLoading || (!!lockoutUntil && Date.now() < lockoutUntil)}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: isLoading || (!!lockoutUntil && Date.now() < lockoutUntil) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)',
            transition: 'opacity 0.2s',
            opacity: isLoading || (!!lockoutUntil && Date.now() < lockoutUntil) ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 20,
                height: 20,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
              }}
            />
          ) : (
            <>
              {noPassword ? <Unlock size={16} /> : <Lock size={16} />}
              解锁
            </>
          )}
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: noPassword ? 0.5 : 0.6, duration: 0.3 }}
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          {noPassword ? '点击按钮即可解锁' : '按 Enter 键快速解锁'}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default PrivacyLock;
