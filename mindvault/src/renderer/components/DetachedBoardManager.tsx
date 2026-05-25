import React from 'react';
import DetachedBoardWindow from './board/DetachedBoardWindow';
import { useUIStore } from '../stores/uiStore';

const DetachedBoardManager: React.FC = () => {
  const detachedBoardWindows = useUIStore((s) => s.detachedBoardWindows);
  const closeDetachedBoard = useUIStore((s) => s.closeDetachedBoard);

  return (
    <>
      {detachedBoardWindows.map((win, index) => (
        <DetachedBoardWindow
          key={win.id}
          windowId={win.id}
          boardId={win.boardId}
          onClose={() => closeDetachedBoard(win.id)}
          zIndex={1000 + index * 10}
        />
      ))}
    </>
  );
};

export default DetachedBoardManager;
