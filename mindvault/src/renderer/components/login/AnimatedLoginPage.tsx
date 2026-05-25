import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import AnimatedCharacters, { CharacterState } from './AnimatedCharacters';
import LoginForm, { FormMode } from './LoginForm';
import { useAuth } from '../../hooks/useAuth';
import './animated-login.css';

interface AnimatedLoginPageProps {
  onSkip?: () => void;
}

const AnimatedLoginPage: React.FC<AnimatedLoginPageProps> = ({ onSkip }) => {
  const [mode, setMode] = useState<FormMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // 角色状态
  const [characterStates, setCharacterStates] = useState<{
    purple: CharacterState;
    black: CharacterState;
    orange: CharacterState;
    yellow: CharacterState;
  }>({
    purple: 'idle',
    black: 'idle',
    orange: 'idle',
    yellow: 'idle',
  });

  // 更新所有角色状态
  const updateAllCharacters = useCallback((state: CharacterState) => {
    setCharacterStates({
      purple: state,
      black: state,
      orange: state,
      yellow: state,
    });
  }, []);

  // 输入框聚焦时的角色反应
  const handleInputFocus = useCallback((field: 'email' | 'password') => {
    if (field === 'email') {
      // 输入邮箱时，角色互相对视
      updateAllCharacters('looking');
    } else if (field === 'password') {
      // 输入密码时，角色回避
      if (!passwordVisible) {
        updateAllCharacters('avoiding');
      } else {
        // 密码可见时，紫色偶尔偷看
        setCharacterStates({
          purple: Math.random() > 0.7 ? 'peeking' : 'avoiding',
          black: 'avoiding',
          orange: 'avoiding',
          yellow: 'avoiding',
        });
      }
    }
  }, [passwordVisible, updateAllCharacters]);

  // 输入框失焦时恢复空闲状态
  const handleInputBlur = useCallback(() => {
    updateAllCharacters('idle');
  }, [updateAllCharacters]);

  // 密码可见性变化
  const handlePasswordVisible = useCallback((visible: boolean) => {
    setPasswordVisible(visible);
    if (visible) {
      // 密码可见时，角色看向远处，紫色偶尔偷看
      setCharacterStates({
        purple: Math.random() > 0.5 ? 'peeking' : 'avoiding',
        black: 'avoiding',
        orange: 'avoiding',
        yellow: 'avoiding',
      });
    } else {
      // 密码隐藏时，角色回避
      updateAllCharacters('avoiding');
    }
  }, [updateAllCharacters]);

  // 处理登录/注册
  const handleSubmit = useCallback(async (email: string, password: string, nickname?: string) => {
    setError(null);
    setIsError(false);

    if (!email.trim()) {
      setError('请输入邮箱');
      setIsError(true);
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('密码至少 6 位');
      setIsError(true);
      return;
    }
    if (mode === 'register' && !nickname?.trim()) {
      setError('请输入昵称');
      setIsError(true);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setError(
            error.message === 'Invalid login credentials'
              ? '邮箱或密码错误'
              : `登录失败: ${error.message}`
          );
          setIsError(true);
          // 登录失败时角色沮丧
          updateAllCharacters('sad');
        } else {
          message.success('登录成功');
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password, nickname || '');
        if (error) {
          if (error.message.includes('already registered')) {
            setError('该邮箱已注册，请直接登录');
            setMode('login');
          } else {
            setError(`注册失败: ${error.message}`);
          }
          setIsError(true);
          updateAllCharacters('sad');
        } else {
          message.success('注册成功！请查收验证邮件（如需），然后登录');
          setMode('login');
        }
      }
    } catch {
      setError('操作失败，请重试');
      setIsError(true);
      updateAllCharacters('sad');
    } finally {
      setLoading(false);
    }
  }, [mode, signIn, signUp, navigate, updateAllCharacters]);

  // 跳过登录
  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    } else {
      navigate('/');
    }
  }, [onSkip, navigate]);

  // 模式切换时重置错误
  const handleModeChange = useCallback((newMode: FormMode) => {
    setMode(newMode);
    setError(null);
    setIsError(false);
    updateAllCharacters('idle');
  }, [updateAllCharacters]);

  return (
    <div className="animated-login-page">
      {/* 左侧面板 - 动画角色 */}
      <div className="left-panel">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L15 9H9L12 2Z" />
            <path d="M12 22L9 15H15L12 22Z" />
            <path d="M2 12L9 9V15L2 12Z" />
            <path d="M22 12L15 15V9L22 12Z" />
          </svg>
          <span>脑洞集</span>
        </div>
        <div className="characters-wrapper">
          <AnimatedCharacters characterStates={characterStates} isError={isError} />
        </div>
        <div className="footer-links">
          <a href="#" onClick={(e) => e.preventDefault()}>隐私政策</a>
          <a href="#" onClick={(e) => e.preventDefault()}>服务条款</a>
          <a href="#" onClick={(e) => e.preventDefault()}>联系我们</a>
        </div>
      </div>

      {/* 右侧面板 - 登录表单 */}
      <div className="right-panel">
        <LoginForm
          mode={mode}
          onModeChange={handleModeChange}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          loading={loading}
          error={error}
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
          onPasswordVisible={handlePasswordVisible}
        />
      </div>
    </div>
  );
};

export default AnimatedLoginPage;
