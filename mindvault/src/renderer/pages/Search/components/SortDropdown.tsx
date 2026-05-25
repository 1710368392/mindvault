import React from 'react';
import { Button, Dropdown } from 'antd';
import { Clock } from 'lucide-react';
import { SORT_OPTIONS } from '../constants';

interface SortDropdownProps {
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ sortField, sortOrder, onSort }) => {
  const currentSortOption = SORT_OPTIONS.find((o) => o.value === sortField) || SORT_OPTIONS[0];

  return (
    <Dropdown
      menu={{
        items: SORT_OPTIONS.map((opt) => ({
          key: opt.value,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {opt.label}
              {sortField === opt.value && (
                <span style={{ color: 'var(--primary-color)' }}>
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          ),
          onClick: () => onSort(opt.value),
        })),
      }}
    >
      <Button icon={<Clock size={16} />} style={{ height: 44, borderRadius: 10 }}>
        {currentSortOption.label}
      </Button>
    </Dropdown>
  );
};

export default SortDropdown;
