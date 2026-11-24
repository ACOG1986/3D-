import { useMemo } from 'react';
import { useWardrobe } from '../store/wardrobeStore';
import { makeT } from '.';

export function useT() {
  const lang = useWardrobe((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}
