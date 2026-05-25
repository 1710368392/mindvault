import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export type FormMode = 'login' | 'register';

interface LoginFormProps {
  mode: FormMode;
  onModeChange: (mode: FormMode) => void;
  onSubmit: (email: string, password: string, nickname?: string) => void;
  onSkip: () => void;
  loading?: boolean;
  error?: string | null;
  onInputFocus?: (field: 'email' | 'password') => void;
  onInputBlur?: () => void;
  onPasswordVisible?: (visible: boolean) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({
  mode,
  onModeChange,
  onSubmit,
  onSkip,
  loading = false,
  error = null,
  onInputFocus,
  onInputBlur,
  onPasswordVisible,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password, mode === 'register' ? nickname : undefined);
  };

  const handleTogglePassword = () => {
    const newVisible = !showPassword;
    setShowPassword(newVisible);
    onPasswordVisible?.(newVisible);
  };

  return (
    <div className="form-container">
      {/* 图标 */}
      <div className="sparkle-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L13.5 9H10.5L12 2Z" fill="var(--primary-color, #1a1a2e)" />
          <path d="M12 22L10.5 15H13.5L12 22Z" fill="var(--primary-color, #1a1a2e)" />
          <path d="M2 12L9 10.5V13.5L2 12Z" fill="var(--primary-color, #1a1a2e)" />
          <path d="M22 12L15 13.5V10.5L22 12Z" fill="var(--primary-color, #1a1a2e)" />
        </svg>
      </div>

      {/* 标题 */}
      <div className="form-header">
        <h1>{mode === 'login' ? '欢迎回来！' : '创建账号'}</h1>
        <p>{mode === 'login' ? '登录你的账号，数据云端同步' : '创建账号，开始记录创意'}</p>
      </div>

      {/* 错误提示 */}
      {error && <div className="error-msg visible">{error}</div>}

      {/* 模式切换 */}
      <div className="mode-switch">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => onModeChange('login')}
        >
          登录
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => onModeChange('register')}
        >
          注册
        </button>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit}>
        {/* 昵称（仅注册） */}
        {mode === 'register' && (
          <div className="form-group">
            <label htmlFor="nickname">昵称</label>
            <div className="input-wrapper">
              <input
                type="text"
                id="nickname"
                placeholder="请输入昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* 邮箱 */}
        <div className="form-group">
          <label htmlFor="email">邮箱</label>
          <div className="input-wrapper">
            <input
              type="email"
              id="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => onInputFocus?.('email')}
              onBlur={() => onInputBlur?.()}
              autoComplete="email"
            />
          </div>
        </div>

        {/* 密码 */}
        <div className="form-group">
          <label htmlFor="password">密码</label>
          <div className="input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => onInputFocus?.('password')}
              onBlur={() => onInputBlur?.()}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={handleTogglePassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* 记住我和忘记密码 */}
        {mode === 'login' && (
          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>记住我</span>
            </label>
            <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
              忘记密码？
            </a>
          </div>
        )}

        {/* 登录/注册按钮 */}
        <button type="submit" className="btn-login" disabled={loading}>
          <span className="btn-text">{mode === 'login' ? '登录' : '注册'}</span>
          <span className="btn-hover-content">
            <ArrowRight size={18} />
          </span>
        </button>

        {/* Google 登录 */}
        <button type="button" className="btn-google" disabled={loading}>
          <span className="btn-text">
            <svg className="google-icon" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            使用 Google 登录
          </span>
          <span className="btn-hover-content">
            <ArrowRight size={18} />
          </span>
        </button>
      </form>

      {/* 跳过 */}
      <div className="signup-link">
        {mode === 'login' ? (
          <>
            还没有账号？{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onModeChange('register'); }}>
              立即注册
            </a>
          </>
        ) : (
          <>
            已有账号？{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onModeChange('login'); }}>
              立即登录
            </a>
          </>
        )}
      </div>

      {/* 本地模式 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary, #999)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          跳过，使用本地模式
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
