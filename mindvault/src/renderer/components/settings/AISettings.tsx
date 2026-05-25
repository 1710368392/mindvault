import React, { useState, useCallback } from 'react';
import { Tabs, Input, AutoComplete, Switch, Button } from 'antd';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, BookOpen, Database } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { api } from '../../utils/api';
import type { AIProviderConfig } from '../../../shared/types';
import { AIRulesPanel } from '../AIRulesPanel';
import RAGManagementPanel from '../RAGManagementPanel';

const { TextArea } = Input;

/** 各提供商的模型建议列表 */
const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: [
    'gpt-5.5',
    'gpt-5.5-pro',
    'gpt-5.5-instant',
    'gpt-5',
    'o3',
    'o3-mini',
    'o4-mini',
  ],
  anthropic: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4',
  ],
  deepseek: [
    'deepseek-v4-pro',
    'deepseek-v4-flash',
    'deepseek-v4',
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  custom: [],
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  custom: '自定义 (OpenAI 兼容)',
};

export const AISettings: React.FC = () => {
  const { settings, saveSetting, saveSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<string>(settings.aiDefaultProvider);

  // 各提供商的本地编辑状态
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.aiOpenaiApiKey);
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(settings.aiOpenaiBaseUrl);
  const [openaiModel, setOpenaiModel] = useState(settings.aiOpenaiModel);

  const [anthropicApiKey, setAnthropicApiKey] = useState(settings.aiAnthropicApiKey);
  const [anthropicModel, setAnthropicModel] = useState(settings.aiAnthropicModel);

  const [deepseekApiKey, setDeepseekApiKey] = useState(settings.aiDeepseekApiKey);
  const [deepseekModel, setDeepseekModel] = useState(settings.aiDeepseekModel);

  const [customApiKey, setCustomApiKey] = useState(settings.aiCustomApiKey);
  const [customBaseUrl, setCustomBaseUrl] = useState(settings.aiCustomBaseUrl);
  const [customModel, setCustomModel] = useState(settings.aiCustomModel);

  // 密码可见性
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // 测试连接状态
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  const toggleKeyVisibility = (key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** 保存当前 Tab 的配置 */
  const saveCurrentTab = useCallback(() => {
    const updates: Record<string, any> = {};

    if (activeTab === 'openai') {
      updates.aiOpenaiApiKey = openaiApiKey;
      updates.aiOpenaiBaseUrl = openaiBaseUrl;
      updates.aiOpenaiModel = openaiModel;
    } else if (activeTab === 'anthropic') {
      updates.aiAnthropicApiKey = anthropicApiKey;
      updates.aiAnthropicModel = anthropicModel;
    } else if (activeTab === 'deepseek') {
      updates.aiDeepseekApiKey = deepseekApiKey;
      updates.aiDeepseekModel = deepseekModel;
    } else if (activeTab === 'custom') {
      updates.aiCustomApiKey = customApiKey;
      updates.aiCustomBaseUrl = customBaseUrl;
      updates.aiCustomModel = customModel;
    }

    updates.aiDefaultProvider = activeTab;
    // 同步默认模型
    if (activeTab === 'openai') updates.aiDefaultModel = openaiModel;
    else if (activeTab === 'anthropic') updates.aiDefaultModel = anthropicModel;
    else if (activeTab === 'deepseek') updates.aiDefaultModel = deepseekModel;
    else if (activeTab === 'custom') updates.aiDefaultModel = customModel;

    saveSettings(updates);
  }, [activeTab, openaiApiKey, openaiBaseUrl, openaiModel, anthropicApiKey, anthropicModel, deepseekApiKey, deepseekModel, customApiKey, customBaseUrl, customModel, saveSettings]);

  /** 测试连接 */
  const testConnection = useCallback(async (provider: string) => {
    setTestingProvider(provider);
    setTestResult(null);

    let config: AIProviderConfig;
    if (provider === 'openai') {
      config = { provider: 'openai', apiKey: openaiApiKey, baseUrl: openaiBaseUrl, model: openaiModel };
    } else if (provider === 'anthropic') {
      config = { provider: 'anthropic', apiKey: anthropicApiKey, model: anthropicModel };
    } else if (provider === 'deepseek') {
      config = { provider: 'deepseek', apiKey: deepseekApiKey, model: deepseekModel };
    } else {
      config = { provider: 'custom', apiKey: customApiKey, baseUrl: customBaseUrl, model: customModel };
    }

    try {
      const result = await api.ai.testConnection(config);
      setTestResult({
        provider,
        success: result.success,
        latency: result.latency,
        error: result.error,
      });
      // 连接成功后自动设为默认提供商
      if (result.success && provider !== settings.aiDefaultProvider) {
        saveSettings({
          aiDefaultProvider: provider as any,
          aiDefaultModel: config.model,
        });
      }
    } catch (err: any) {
      setTestResult({
        provider,
        success: false,
        error: err?.message || '连接测试失败',
      });
    } finally {
      setTestingProvider(null);
    }
  }, [openaiApiKey, openaiBaseUrl, openaiModel, anthropicApiKey, anthropicModel, deepseekApiKey, deepseekModel, customApiKey, customBaseUrl, customModel]);

  /** 渲染密码输入框 */
  const renderPasswordField = (label: string, value: string, onChange: (v: string) => void, fieldKey: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Input.Password
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`请输入${label}`}
          visibilityToggle={false}
          style={{
            width: '100%',
            paddingRight: 40,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={() => toggleKeyVisibility(fieldKey)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          tabIndex={-1}
        >
          {visibleKeys[fieldKey] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  /** 渲染普通输入框 */
  const renderTextField = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );

  /** 渲染模型选择 */
  const renderModelSelect = (label: string, value: string, onChange: (v: string) => void, provider: string) => {
    const suggestions = MODEL_SUGGESTIONS[provider] || [];
    const options = suggestions.map((m) => ({ value: m, label: m }));

    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
          {label}
        </label>
        <AutoComplete
          value={value}
          onChange={(val) => onChange(val)}
          options={options}
          placeholder="输入或选择模型"
          filterOption={(input, option) =>
            (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
        >
          <Input
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </AutoComplete>
      </div>
    );
  };

  /** 渲染测试连接结果 */
  const renderTestResult = (provider: string) => {
    if (!testResult || testResult.provider !== provider) return null;
    if (testingProvider === provider) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          <span>正在测试连接...</span>
        </div>
      );
    }
    if (testResult.success) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: '#52c41a', fontSize: 13 }}>
          <CheckCircle size={14} />
          <span>连接成功{testResult.latency ? ` (${testResult.latency}ms)` : ''}</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: '#ff4d4f', fontSize: 13 }}>
        <XCircle size={14} />
        <span>连接失败: {testResult.error || '未知错误'}</span>
      </div>
    );
  };

  const tabItems = [
    {
      key: 'openai',
      label: 'OpenAI',
      children: (
        <div>
          {renderPasswordField('API Key', openaiApiKey, setOpenaiApiKey, 'openai')}
          {renderTextField('Base URL', openaiBaseUrl, setOpenaiBaseUrl, 'https://api.openai.com/v1')}
          {renderModelSelect('模型', openaiModel, setOpenaiModel, 'openai')}
          <Button
            type="primary"
            loading={testingProvider === 'openai'}
            onClick={() => testConnection('openai')}
            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
          >
            测试连接
          </Button>
          {renderTestResult('openai')}
        </div>
      ),
    },
    {
      key: 'anthropic',
      label: 'Anthropic',
      children: (
        <div>
          {renderPasswordField('API Key', anthropicApiKey, setAnthropicApiKey, 'anthropic')}
          {renderModelSelect('模型', anthropicModel, setAnthropicModel, 'anthropic')}
          <Button
            type="primary"
            loading={testingProvider === 'anthropic'}
            onClick={() => testConnection('anthropic')}
            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
          >
            测试连接
          </Button>
          {renderTestResult('anthropic')}
        </div>
      ),
    },
    {
      key: 'deepseek',
      label: 'DeepSeek',
      children: (
        <div>
          {renderPasswordField('API Key', deepseekApiKey, setDeepseekApiKey, 'deepseek')}
          {renderModelSelect('模型', deepseekModel, setDeepseekModel, 'deepseek')}
          <Button
            type="primary"
            loading={testingProvider === 'deepseek'}
            onClick={() => testConnection('deepseek')}
            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
          >
            测试连接
          </Button>
          {renderTestResult('deepseek')}
        </div>
      ),
    },
    {
      key: 'custom',
      label: '自定义 (OpenAI 兼容)',
      children: (
        <div>
          {renderPasswordField('API Key', customApiKey, setCustomApiKey, 'custom')}
          {renderTextField('Base URL', customBaseUrl, setCustomBaseUrl, 'https://your-api.example.com/v1')}
          {renderModelSelect('模型', customModel, setCustomModel, 'custom')}
          <Button
            type="primary"
            loading={testingProvider === 'custom'}
            onClick={() => testConnection('custom')}
            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
          >
            测试连接
          </Button>
          {renderTestResult('custom')}
        </div>
      ),
    },
    {
      key: 'rules',
      label: (
        <span>
          <BookOpen size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          AI 规则
        </span>
      ),
      children: <AIRulesPanel />,
    },
    {
      key: 'rag',
      label: (
        <span>
          <Database size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          RAG 知识库
        </span>
      ),
      children: <RAGManagementPanel />,
    },
  ];

  return (
    <div style={{ padding: '8px 0' }}>
      {/* 旋转动画 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* AI 总开关 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>启用 AI 助手</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 2 }}>
            开启后可在应用中使用 AI 对话功能
          </div>
        </div>
        <Switch
          checked={settings.aiEnabled}
          onChange={(checked) => saveSetting('aiEnabled', checked)}
          style={{ marginTop: 2 }}
        />
      </div>

      {/* 提供商配置 Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          // 切换 Tab 前先保存当前配置
          saveCurrentTab();
          setActiveTab(key);
        }}
        items={tabItems}
        style={{
          '--ant-color-primary': 'var(--primary-color)',
        } as React.CSSProperties}
      />

      {/* 默认提供商选择 */}
      <div
        style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>
          当前默认提供商
        </div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 14 }}>
          {PROVIDER_LABELS[activeTab] || activeTab}
        </div>
      </div>
    </div>
  );
};
