import React from 'react';
import { Input, Button } from 'antd';
import { Search as SearchIconLucide, X } from 'lucide-react';

interface SearchBarProps {
  keyword: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ keyword, onChange, onSearch }) => {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <SearchIconLucide
        size={18}
        style={{
          position: 'absolute',
          left: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)',
          opacity: 0.6,
        }}
      />
      <Input
        placeholder="搜索创意、标签、内容..."
        value={keyword}
        onChange={(e) => onChange(e.target.value)}
        onPressEnter={onSearch}
        style={{
          paddingLeft: 42,
          height: 44,
          borderRadius: 10,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
        }}
      />
      {keyword && (
        <Button
          type="text"
          icon={<X size={16} />}
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      )}
    </div>
  );
};

export default SearchBar;
