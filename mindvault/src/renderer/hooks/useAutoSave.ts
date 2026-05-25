import { useEffect, useRef } from 'react';

export function useAutoSave(
  content: string,
  delay: number = 30000,
  onSave: () => void
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (content.trim()) {
      timeoutRef.current = setTimeout(() => {
        onSaveRef.current();
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, delay]);

  const save = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onSaveRef.current();
  };

  return { save };
}
