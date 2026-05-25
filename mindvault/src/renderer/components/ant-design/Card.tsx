import React from 'react';

export type CardSize = 'default' | 'small';

interface CardProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  size?: CardSize;
  type?: 'inner' | 'default';
  cover?: React.ReactNode;
  actions?: React.ReactNode[];
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({
  title,
  extra,
  bordered = true,
  hoverable = false,
  size = 'default',
  type = 'default',
  cover,
  actions,
  className = '',
  children,
  style,
  bodyStyle,
}) => {
  const classes = [
    'ant-card',
    hoverable ? 'ant-card-hoverable' : '',
    size === 'small' ? 'ant-card-small' : '',
    type === 'inner' ? 'ant-card-type-inner' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      {cover && (
        <div className="ant-card-cover">
          {cover}
        </div>
      )}
      {(title || extra) && (
        <div className="ant-card-head">
          <div className="ant-card-head-wrapper">
            {title && (
              <div className="ant-card-head-title">
                {title}
              </div>
            )}
            {extra && (
              <div className="ant-card-head-extra">
                {extra}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="ant-card-body" style={bodyStyle}>
        {children}
      </div>
      {actions && actions.length > 0 && (
        <ul className="ant-card-actions">
          {actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Card;
