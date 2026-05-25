import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export type InputSize = 'small' | 'middle' | 'large';
export type InputStatus = 'error' | 'warning' | 'default';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 输入框大小 */
  size?: InputSize;
  /** 带标签的 input */
  prefix?: React.ReactNode;
  /** 后缀图标 */
  suffix?: React.ReactNode;
  /** 输入框状态 */
  status?: InputStatus;
  /** 是否允许清空 */
  allowClear?: boolean;
  /** 前缀 */
  addonBefore?: React.ReactNode;
  /** 后缀 */
  addonAfter?: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  size = 'middle',
  prefix,
  suffix,
  status = 'default',
  allowClear = false,
  addonBefore,
  addonAfter,
  className = '',
  value,
  onChange,
  type,
  ...restProps
}, ref) => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [innerValue, setInnerValue] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInnerValue(e.target.value);
    onChange?.(e);
  };

  const handleClear = () => {
    const event = { target: { value: '' } } as React.ChangeEvent<HTMLInputElement>;
    handleChange(event);
  };

  const getInputType = () => {
    if (type === 'password') {
      return passwordVisible ? 'text' : 'password';
    }
    return type;
  };

  const classes = [
    'ant-input',
    size === 'large' ? 'ant-input-lg' : size === 'small' ? 'ant-input-sm' : '',
    status === 'error' ? 'ant-input-status-error' : status === 'warning' ? 'ant-input-status-warning' : '',
    className,
  ].filter(Boolean).join(' ');

  const showPrefix = prefix || (allowClear && innerValue) || type === 'password';
  const showSuffix = suffix || (allowClear && innerValue) || type === 'password';

  if (addonBefore || addonAfter) {
    return (
      <span className="ant-input-group-wrapper">
        <span className="ant-input-group">
          {addonBefore && (
            <span className="ant-input-group-addon">{addonBefore}</span>
          )}
          <input
            ref={ref}
            type={getInputType()}
            className={classes}
            value={innerValue}
            onChange={handleChange}
            {...restProps}
          />
          {addonAfter && (
            <span className="ant-input-group-addon">{addonAfter}</span>
          )}
        </span>
      </span>
    );
  }

  if (showPrefix || showSuffix) {
    return (
      <span className="ant-input-affix-wrapper">
        {prefix && (
          <span className="ant-input-prefix">{prefix}</span>
        )}
        <input
          ref={ref}
          type={getInputType()}
          className="ant-input"
          value={innerValue}
          onChange={handleChange}
          {...restProps}
        />
        <span className="ant-input-suffix">
          {suffix}
          {allowClear && innerValue && (
            <span
              onClick={handleClear}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              ✕
            </span>
          )}
          {type === 'password' && (
            <span
              onClick={() => setPasswordVisible(!passwordVisible)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </span>
          )}
        </span>
      </span>
    );
  }

  return (
    <input
      ref={ref}
      type={getInputType()}
      className={classes}
      value={innerValue}
      onChange={handleChange}
      {...restProps}
    />
  );
});

Input.displayName = 'Input';

export default Input;
