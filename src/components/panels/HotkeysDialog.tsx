import { useEffect, useRef } from 'react';
import { useT } from '../../i18n/useT';

export function HotkeysDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const rows: [string, string][] = [
    ['Ctrl+Z', t('keys.undo')],
    ['Ctrl+Y / Ctrl+Shift+Z', t('keys.redo')],
    ['Delete', t('keys.delete')],
    ['Ctrl+D', t('keys.duplicate')],
    ['↑ / ↓', t('keys.move')],
    ['1 2 3 4', t('keys.views')],
    ['E', t('keys.explode')],
    ['F', t('keys.facades')],
    ['Esc', t('keys.escape')],
    ['?', t('top.hotkeys')],
  ];
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(92vw,420px)] rounded-lg bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/40 dark:bg-slate-900 dark:text-slate-100"
      aria-labelledby="hotkeys-title"
    >
      <div className="p-4">
        <h2 id="hotkeys-title" className="mb-3 text-base font-semibold">
          {t('keys.title')}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs dark:border-slate-600">{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 text-right">
          <button type="button" className="btn" onClick={onClose} autoFocus>
            {t('keys.close')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
