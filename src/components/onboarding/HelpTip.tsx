import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../../i18n/useT';

export interface HelpTipProps {
  /** Термин, к которому относится подсказка (для aria-label). */
  term: string;
  /** Текст подсказки простым языком. */
  text: string;
  /** Сторона, в которую раскрывается подсказка. */
  align?: 'left' | 'right';
}

/**
 * Значок «i» с подсказкой: открывается при наведении, фокусе или клике,
 * закрывается по Esc и при клике вне. Текст связан через aria-describedby.
 */
export function HelpTip({ term, text, align = 'left' }: HelpTipProps) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [pinned]);

  const visible = open || pinned;
  return (
    <span ref={ref} className="relative inline-flex align-middle normal-case tracking-normal">
      <button
        type="button"
        aria-label={t('help.label', { term })}
        aria-describedby={visible ? id : undefined}
        aria-expanded={visible}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setPinned(!pinned);
          setOpen(!pinned);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setPinned(false);
            setOpen(false);
            e.stopPropagation();
          }
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-400 text-[10px] font-semibold leading-none text-slate-500 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-500 dark:text-slate-400"
      >
        i
      </button>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-6 z-50 w-60 rounded-md bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-xl dark:bg-slate-700 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
