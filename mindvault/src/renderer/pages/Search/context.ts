import React from 'react';

export const BatchSelectionContext = React.createContext<{
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
}>({ selectedIds: new Set(), toggleSelect: () => {} });
