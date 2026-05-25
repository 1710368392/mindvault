import React from 'react';
import CardEditor from './card/CardEditor';
import { useUIStore } from '../stores/uiStore';
import { useCreativityStore } from '../stores/creativityStore';

const FloatingEditorManager: React.FC = () => {
  const editorWindows = useUIStore((s) => s.editorWindows);
  const closeEditor = useUIStore((s) => s.closeEditor);
  const updateCreativity = useCreativityStore((s) => s.updateCreativity);
  const createCreativity = useCreativityStore((s) => s.createCreativity);

  const handleSave = async (windowId: string, data: any) => {
    const win = editorWindows.find(w => w.id === windowId);
    if (!win) return false;

    if (win.creativity) {
      const success = await updateCreativity(win.creativity.id, data);
      if (success) closeEditor(windowId);
      return success;
    } else {
      const result = await createCreativity(data);
      if (result && result.id) {
        closeEditor(windowId);
        return result;
      }
      return false;
    }
  };

  return (
    <>
      {editorWindows.map((win, index) => (
        <CardEditor
          key={win.id}
          windowId={win.id}
          creativity={win.creativity}
          onClose={() => closeEditor(win.id)}
          onSave={(data) => handleSave(win.id, data)}
          zIndex={1000 + index * 10}
        />
      ))}
    </>
  );
};

export default FloatingEditorManager;
