import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { useWardrobe } from '../../store/wardrobeStore';

const KEY = 'wardrobe.hint.dnd.v1';

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Подсказка первого шага поверх сцены: как добавлять элементы.
 * Скрывается крестиком или сама после первого изменения шкафа.
 */
export function DndHint() {
  const t = useT();
  const [hidden, setHidden] = useState(dismissed);
  const edited = useWardrobe((s) => s.past.length > 0);
  if (hidden || edited) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* не критично */
    }
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center px-4 lg:bottom-4">
      <div
        role="note"
        className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl bg-slate-900/90 px-4 py-3 text-sm text-white shadow-xl backdrop-blur dark:bg-slate-700/95"
      >
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4.5A5.5 5.5 0 0 1 11.5 21h-.6a5 5 0 0 1-4-2l-2.6-3.5a1.5 1.5 0 0 1 2.3-1.9L8 15" />
        </svg>
        <p className="leading-snug">
          <span className="hidden lg:inline">{t('hint.dnd')}</span>
          <span className="lg:hidden">{t('hint.dndTablet')}</span>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={t('hint.dismiss')}
          className="-mr-1 rounded px-1.5 text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
