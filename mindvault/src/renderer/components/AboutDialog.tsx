import React from 'react';
import { Modal } from 'antd';

interface AboutDialogProps {
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      centered
      width={400}
      closable={true}
    >
      <div style={{
        padding: '20px 0 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(108, 99, 255, 0.25)',
        }}>
          <img src="./images/app-logo.png" alt="Logo" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}>
          脑洞集
        </h2>

        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}>
          v1.0.0
        </span>

        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 28,
          maxWidth: 300,
        }}>
          一款面向个人用户的创意记录与整理桌面软件
        </p>

        <div style={{
          width: '100%',
          height: 1,
          backgroundColor: 'var(--border-light)',
          marginBottom: 20,
        }} />

        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {['Electron', 'React', 'TypeScript'].map((tech) => (
            <span
              key={tech}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderLeft: '1px solid rgba(255,255,255,0.04)',
                borderRight: '1px solid rgba(0,0,0,0.12)',
                borderBottom: '3px solid rgba(0,0,0,0.2)',
                boxShadow: '0 2px 0 rgba(0,0,0,0.12), 0 3px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                textShadow: '0 1px 0 rgba(255,255,255,0.05)',
                letterSpacing: 0.5,
              }}
            >
              {tech}
            </span>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>作者：</span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--primary-color)', fontWeight: 600 }}>糖心月</span>
        </div>

        <p style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-tertiary)',
        }}>
          &copy; {new Date().getFullYear()} 糖心月 All Rights Reserved
        </p>
      </div>
    </Modal>
  );
};

export default AboutDialog;
