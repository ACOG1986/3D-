import { useEffect, useRef, useState } from 'react';
import { LANGS, LOCALE, type Lang } from '../../i18n';
import { useT } from '../../i18n/useT';
import { sheetCount } from '../../lib/drawing';
import { exportJson, exportPdf, exportPng, exportSvg } from '../../lib/export';
import { useWardrobe, type ViewMode } from '../../store/wardrobeStore';

export function TopBar({ onHotkeys, onTour }: { onHotkeys: () => void; onTour: () => void }) {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const lang = useWardrobe((s) => s.lang);
  const specMode = useWardrobe((s) => s.specMode);
  const view = useWardrobe((s) => s.view);
  const setView = useWardrobe((s) => s.setView);
  const undo = useWardrobe((s) => s.undo);
  const redo = useWardrobe((s) => s.redo);
  const canUndo = useWardrobe((s) => s.past.length > 0);
  const canRedo = useWardrobe((s) => s.future.length > 0);
  const saveState = useWardrobe((s) => s.saveState);
  const savedAt = useWardrobe((s) => s.savedAt);
  const theme = useWardrobe((s) => s.theme);
  const setTheme = useWardrobe((s) => s.setTheme);
  const setLang = useWardrobe((s) => s.setLang);
  const patch = useWardrobe((s) => s.patch);
  const [menu, setMenu] = useState(false);
  const SHEETS = Array.from({ length: sheetCount(w) }, (_, i) => i + 1);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(w.name);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => setName(w.name), [w.name]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const run = async (fn: () => Promise<void> | void) => {
    setMenu(false);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      window.alert(t('export.error', { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const views: [ViewMode, string, string][] = [
    ['3d', t('view.3d'), '1'],
    ['front', t('view.front'), '2'],
    ['top', t('view.top'), '3'],
    ['drawing', t('view.drawing'), '4'],
  ];
  const time = savedAt ? new Date(savedAt).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <a href="#/projects" className="btn" title={t('top.projects')}>
        <span aria-hidden>←</span>
        <span className="hidden lg:inline">{t('top.projects')}</span>
      </a>
      <input
        aria-label={t('top.projectName')}
        className="input w-40 font-medium lg:w-56"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== w.name && patch({ name: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
      />
      <div className="flex gap-1">
        <button type="button" className="btn px-2" onClick={undo} disabled={!canUndo} aria-label={t('top.undo')} title={t('top.undo')}>
          ↶
        </button>
        <button type="button" className="btn px-2" onClick={redo} disabled={!canRedo} aria-label={t('top.redo')} title={t('top.redo')}>
          ↷
        </button>
      </div>
      <span className="min-w-[7rem] text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
        {saveState === 'saving' ? t('top.saving') : saveState === 'error' ? '⚠' : savedAt ? `✓ ${t('top.saved', { time })}` : ''}
      </span>

      <div className="seg mx-auto" role="tablist" aria-label={t('view.3d')} data-tour="views">
        {views.map(([v, label, key]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            aria-pressed={view === v}
            onClick={() => setView(v)}
            title={`${label} (${key})`}
          >
            {label}
          </button>
        ))}
      </div>

      <select aria-label={t('lang.label')} className="input py-1 text-xs" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()} · {t(`lang.${l}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn px-2"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={t('top.theme')}
        title={t('top.theme')}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button
        type="button"
        className="btn hidden px-2 xl:inline-flex"
        onClick={onHotkeys}
        aria-label={t('top.hotkeys')}
        title={t('top.hotkeys')}
      >
        ⌨
      </button>
      <button type="button" className="btn px-2" onClick={onTour} aria-label={t('tour.howTo')} title={t('tour.howTo')}>
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200"
        >
          ?
        </span>
        <span className="hidden xl:inline">{t('tour.howTo')}</span>
      </button>
      <div className="relative" ref={menuRef} data-tour="download">
        <button
          type="button"
          className="btn btn-primary flex-col items-start gap-0 py-1 leading-tight"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          disabled={busy}
          title={t('help.download')}
        >
          <span>{busy ? t('export.busy') : `⬇ ${t('top.export')}`}</span>
          <span className="text-[10px] font-normal opacity-80">{t('hint.downloadSub')}</span>
        </button>
        {menu && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            <MenuItem onClick={() => run(() => exportPdf(w, t, lang, { specMode }))}>{t('top.exportPdf')}</MenuItem>
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
            {SHEETS.map((n) => (
              <MenuItem key={`svg${n}`} onClick={() => run(() => exportSvg(w, t, lang, n - 1, { specMode }))}>
                {t('top.exportSvg', { n })}
              </MenuItem>
            ))}
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
            {SHEETS.map((n) => (
              <MenuItem key={`png${n}`} onClick={() => run(() => exportPng(w, t, lang, n - 1, { specMode }))}>
                {t('top.exportPng', { n })}
              </MenuItem>
            ))}
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
            <MenuItem onClick={() => run(() => exportJson(w))}>{t('top.exportJson')}</MenuItem>
          </div>
        )}
      </div>
    </header>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
    >
      {children}
    </button>
  );
}
