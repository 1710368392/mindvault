import React, { useMemo } from 'react';
import { AutoComplete } from 'antd';

interface TagAutoCompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (tag: string) => void;
  existingTags?: string[];
  placeholder?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const TagAutoComplete: React.FC<TagAutoCompleteProps> = ({
  value,
  onChange,
  onSelect,
  existingTags = [],
  placeholder,
  style,
  autoFocus,
  onKeyDown,
}) => {
  const options = useMemo(() => {
    if (!value.trim()) return [];
    return existingTags
      .filter(tag => tag.toLowerCase().includes(value.toLowerCase()))
      .map(tag => ({ value: tag, label: tag }));
  }, [value, existingTags]);

  return (
    <AutoComplete
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      options={options}
      placeholder={placeholder}
      style={style}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
    />
  );
};

export default TagAutoComplete;
