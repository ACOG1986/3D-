import { useRef, useState } from 'react';
import { Wizard } from '../components/onboarding/Wizard';
import { LANGS, LOCALE, type Lang } from '../i18n';
import { useT } from '../i18n/useT';
import { downloadBlob, safeFileName } from '../lib/export';
import { createWardrobe } from '../lib/geometry';
import { getMaterial } from '../lib/materials';
import { deleteProject, duplicateProject, exportProjectJson, importProject, listProjects, saveProject } from '../lib/projects';
import { useWardrobe } from '../store/wardrobeStore';
import type { Wardrobe, WardrobeType } from '../types/wardrobe';

/** Миниатюра шкафа: простой фасадный вид в SVG. */
function Thumb({ w }: { w: Wardrobe }) {
  const n = Math.max(1, w.doors.kind === 'none' ? w.sections.length : w.doors.count);
  const color = getMaterial(w.doors.kind === 'none' ? w.bodyMaterial : w.doors.material).color;
  const body = getMaterial(w.bodyMaterial).color;
  const s = 100 / Math.max(w.width, w.height);
  const W = w.width * s;
  const H = w.height * s;
  return (
    <svg viewBox={`-5 -5 ${W + 10} ${H + 10}`} className="h-28 w-full" aria-hidden>
      <rect x={0} y={0} width={W} height={H} fill={body} stroke="#64748b" strokeWidth={0.6} />
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={(i * W) / n + 0.6}
          y={0.6}
          width={W / n - 1.2}
          height={H - 1.2 - (w.plinth.enabled ? w.plinth.height * s : 0)}
          fill={color}
          stroke="#475569"
          strokeWidth={0.4}
        />
      ))}
    </svg>
  );
}

export function Projects() {
  const t = useT();
  const lang = useWardrobe((s) => s.lang);
  const setLang = useWardrobe((s) => s.setLang);
  const theme = useWardrobe((s) => s.theme);
  const setTheme = useWardrobe((s) => s.setTheme);
  const [items, setItems] = useState<Wardrobe[]>(listProjects);
  const [error, setError] = useState('');
  // Новичку без проектов сразу открываем мастер
  const [wizard, setWizard] = useState(() => listProjects().length === 0);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => setItems(listProjects());

  const create = (type: WardrobeType) => {
    const w = createWardrobe(type, `${t('proj.defaultName')} · ${t(`type.${type}`)}`);
    saveProject(w);
    window.location.hash = `#/editor/${w.id}`;
  };

  const types: WardrobeType[] = ['swing', 'sliding', 'combined', 'built-in', 'corner'];

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
            <rect x="4" y="3" width="24" height="26" rx="2" fill="#2563eb" />
            <path d="M16 3v26M8 10h6M18 18h6" stroke="white" strokeWidth="2" />
          </svg>
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">{t('app.title')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('app.tagline')}</p>
          </div>
          <select
            aria-label={t('lang.label')}
            className="input py-1 text-xs"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
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
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-8">
          <h2 className="panel-title">{t('proj.new')}</h2>
          <button
            type="button"
            onClick={() => setWizard(true)}
            className="group flex w-full items-center gap-4 rounded-xl bg-blue-600 p-5 text-left text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-800"
          >
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 text-3xl transition group-hover:scale-105"
            >
              ＋
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold">{t('wiz.cta')}</span>
              <span className="block text-sm text-blue-100">{t('wiz.ctaHint')}</span>
            </span>
            <span aria-hidden className="ml-auto hidden text-2xl sm:block">
              →
            </span>
          </button>
          <h3 className="mb-2 mt-5 text-xs text-slate-500 dark:text-slate-400">{t('wiz.orTemplate')}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {types.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => create(type)}
                title={t(`wiz.type.${type}`)}
                className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-left text-sm transition hover:border-blue-500 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="text-blue-600" aria-hidden>
                  ＋{' '}
                </span>
                <span className="font-medium">{t(`type.${type}`)}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="panel-title mb-0 mr-auto">{t('proj.title')}</h2>
            <button type="button" className="btn" onClick={() => file.current?.click()}>
              ⤒ {t('proj.import')}
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label={t('proj.import')}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const w = importProject(await f.text());
                if (!w) setError(t('proj.importError'));
                else {
                  setError('');
                  refresh();
                }
              }}
            />
          </div>
          {error && (
            <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          {items.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <p>{t('proj.empty')}</p>
              <button type="button" className="btn btn-primary mt-3" onClick={() => setWizard(true)}>
                {t('wiz.cta')}
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <a href={`#/editor/${w.id}`} className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Thumb w={w} />
                    <h3 className="mt-2 truncate font-medium">{w.name}</h3>
                  </a>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(`type.${w.type}`)} · {w.width}×{w.height}×{w.depth} {t('mm')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t('proj.updated', { date: new Date(w.updatedAt).toLocaleString(LOCALE[lang]) })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <a href={`#/editor/${w.id}`} className="btn btn-primary px-2 py-1 text-xs">
                      {t('proj.open')}
                    </a>
                    <button
                      type="button"
                      className="btn px-2 py-1 text-xs"
                      onClick={() => {
                        duplicateProject(w, t('proj.copy', { name: w.name }));
                        refresh();
                      }}
                    >
                      {t('proj.duplicate')}
                    </button>
                    <button
                      type="button"
                      className="btn px-2 py-1 text-xs"
                      onClick={() =>
                        downloadBlob(new Blob([exportProjectJson(w)], { type: 'application/json' }), `${safeFileName(w.name)}.json`)
                      }
                    >
                      {t('proj.export')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger ml-auto px-2 py-1 text-xs"
                      onClick={() => {
                        if (window.confirm(t('proj.confirmDelete', { name: w.name }))) {
                          deleteProject(w.id);
                          refresh();
                        }
                      }}
                    >
                      {t('proj.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Wizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}
