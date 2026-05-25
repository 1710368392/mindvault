/**
 * 登录/注册页面
 * 使用动画角色交互式登录界面
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message } from 'antd';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedLoginPage from '../components/login/AnimatedLoginPage';
import { isSupabaseConfigured } from '../lib/supabase';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleSkip = () => {
    navigate('/');
  };

  // 如果 Supabase 未配置，显示配置提示
  if (!isSupabaseConfigured) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 20,
            padding: '40px 48px',
            maxWidth: 420,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          <Sparkles size={48} color="#764ba2" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 12 }}>
            云同步未配置
          </h2>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
            请在项目根目录的 <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>.env</code> 文件中
            配置 Supabase 环境变量后重启应用。
          </p>
          <Button type="primary" onClick={handleSkip} size="large" block>
            使用本地模式
          </Button>
        </motion.div>
      </div>
    );
  }

  // 使用动画登录页面
  return <AnimatedLoginPage onSkip={handleSkip} />;
};

export default Login;
