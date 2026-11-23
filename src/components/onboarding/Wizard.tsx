import { useEffect, useMemo, useRef, useState } from 'react';
import type { MessageKey } from '../../i18n';
import { useT } from '../../i18n/useT';
import { LIMITS } from '../../lib/geometry';
import { bodyMaterials, facadeMaterials, type Material } from '../../lib/materials';
import { saveProject } from '../../lib/projects';
import { useWardrobe } from '../../store/wardrobeStore';
import type { WardrobeType } from '../../types/wardrobe';
import { DimensionInput } from '../controls/DimensionInput';
import { swatchStyle } from '../controls/MaterialPicker';
import { buildWardrobe, defaultAnswers, SIZE_PRESETS, type FillPreset, type WizardAnswers } from './buildWardrobe';
import { HelpTip } from './HelpTip';
import { MiniPreview } from './MiniPreview';

const TYPES: { type: WardrobeType; icon: string }[] = [
  { type: 'swing', icon: 'M6 4h36v40H6zM24 4v40M19 22v4M29 22v4' },
  { type: 'sliding', icon: 'M4 4h40v40H4zM4 4h22v40M22 8h22v36M30 20l6 0M33 17l3 3-3 3' },
  { type: 'combined', icon: 'M6 4h36v40H6zM24 4v40M24 28h18M24 36h18M31 32h4M31 40h4' },
  { type: 'built-in', icon: 'M2 2v44M46 2v44M2 2h44M8 6h32v38H8zM24 6v38' },
  { type: 'corner', icon: 'M4 4h40v16H20v24H4zM20 20V4M4 28h16' },
];

const FILLS: { fill: FillPreset; icon: string }[] = [
  { fill: 'hang', icon: 'M6 10h36M12 10l-6 12h12zM24 10l-6 12h12zM36 10l-6 12h12z' },
  { fill: 'shelves', icon: 'M6 8h36M6 18h36M6 28h36M6 38h36' },
  { fill: 'balanced', icon: 'M6 8h16M8 8l-3 8h6zM26 8h16M26 18h16M6 30h36v12H6zM20 36h8' },
];

const STEPS: MessageKey[] = ['wiz.s1', 'wiz.s2', 'wiz.s3', 'wiz.s4', 'wiz.s5'];

function Pictogram({ d, size = 48 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function BigSwatches({
  label,
  value,
  materials,
  onChange,
  help,
}: {
  label: string;
  value: string;
  materials: Material[];
  onChange: (id: string) => void;
  help?: React.ReactNode;
}) {
  const lang = useWardrobe((s) => s.lang);
  return (
    <fieldset>
      <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        {label} {help}
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {materials.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(m.id)}
              className={`flex flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left text-[11px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                on ? 'border-blue-600 ring-2 ring-blue-600' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
              }`}
            >
              <span className="block h-10 rounded border border-black/10" style={swatchStyle(m)} />
              <span className="line-clamp-2">{m.name[lang]}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface WizardProps {
  open: boolean;
  onClose: () => void;
  initialType?: WardrobeType;
}

/** Мастер «Создать шкаф»: 5 шагов простым языком с живым превью. */
export function Wizard({ open, onClose, initialType }: WizardProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<WizardAnswers>(() => defaultAnswers(t('proj.defaultName')));
  const [preset, setPreset] = useState<string>('bedroom');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setStep(0);
      setA({ ...defaultAnswers(t('proj.defaultName')), type: initialType ?? 'swing' });
      setPreset('bedroom');
      d.showModal();
    }
    if (!open && d.open) d.close();
    // сбрасываем ответы только при открытии
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [step, open]);

  const preview = useMemo(() => buildWardrobe(a), [a]);
  const set = (p: Partial<WizardAnswers>) => setA((prev) => ({ ...prev, ...p }));
  const last = step === STEPS.length - 1;

  const create = () => {
    const raw = a.name.trim();
    const name = !raw || raw === t('proj.defaultName') ? `${t('proj.defaultName')} · ${t(`type.${a.type}`)}` : raw;
    const w = buildWardrobe({ ...a, name });
    saveProject(w);
    onClose();
    window.location.hash = `#/editor/${w.id}`;
  };

  const questions: MessageKey[] = ['wiz.q1', 'wiz.q2', 'wiz.q3', 'wiz.q4', 'wiz.q5'];
  const mm = t('mm');
  const fillLabel: Record<FillPreset, MessageKey> = { hang: 'wiz.fill.hang', shelves: 'wiz.fill.shelves', balanced: 'wiz.fill.balanced' };
  const fillHint: Record<FillPreset, MessageKey> = { hang: 'wiz.fill.hangHint', shelves: 'wiz.fill.shelvesHint', balanced: 'wiz.fill.balancedHint' };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="wiz-title"
      className="w-[min(980px,96vw)] max-w-none rounded-xl bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex max-h-[92vh] flex-col">
        {/* Шапка и прогресс */}
        <div className="border-b border-slate-200 px-5 pb-3 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <h2 id="wiz-title" className="mr-auto text-lg font-semibold">
              {t('wiz.title')}
            </h2>
            <span className="text-xs text-slate-500">{t('wiz.step', { n: step + 1, total: STEPS.length })}</span>
            <button type="button" className="btn px-2 py-1" onClick={onClose} aria-label={t('wiz.close')}>
              ✕
            </button>
          </div>
          <ol className="mt-3 grid grid-cols-5 gap-1.5" aria-label={t('wiz.step', { n: step + 1, total: STEPS.length })}>
            {STEPS.map((k, i) => (
              <li key={k}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default"
                >
                  <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <span className={`mt-1 block truncate text-[11px] ${i === step ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-slate-500'}`}>
                    {i + 1}. {t(k)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Содержимое шага + превью */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="p-5">
            <h3 ref={headingRef} tabIndex={-1} className="mb-4 text-xl font-semibold outline-none">
              {t(questions[step])}
            </h3>

            {step === 0 && (
              <div role="radiogroup" aria-label={t('wiz.q1')} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPES.map(({ type, icon }) => {
                  const on = a.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ type, depth: type === 'sliding' && a.depth < 450 ? 600 : a.depth })}
                      onDoubleClick={() => setStep(1)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-950' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <span className={on ? 'text-blue-600' : 'text-slate-500'}>
                        <Pictogram d={icon} />
                      </span>
                      <span>
                        <span className="block font-medium">{t(`type.${type}`)}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-600 dark:text-slate-400">{t(`wiz.type.${type}`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('wiz.q2')}>
                  {SIZE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={preset === p.key}
                      className={`rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        preset === p.key ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-950' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                      }`}
                      onClick={() => {
                        setPreset(p.key);
                        set({ width: p.width, height: p.height, depth: p.depth });
                      }}
                    >
                      <span className="block font-medium">{t(`wiz.preset.${p.key}`)}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {p.width}×{p.height}×{p.depth}
                      </span>
                    </button>
                  ))}
                  <span
                    className={`self-center rounded-lg px-3 py-2 text-sm ${preset === 'custom' ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-slate-500'}`}
                  >
                    {t('wiz.preset.custom')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(['width', 'height', 'depth'] as const).map((k) => (
                    <div key={k} className="flex flex-col gap-1">
                      <DimensionInput
                        label={t(`right.${k}`)}
                        value={a[k]}
                        min={LIMITS[k].min}
                        max={LIMITS[k].max}
                        step={10}
                        unit={mm}
                        onCommit={(v) => {
                          setPreset('custom');
                          set({ [k]: Math.round(v) } as Partial<WizardAnswers>);
                        }}
                      />
                      <span className="text-[11px] leading-snug text-slate-500">{t(k === 'width' ? 'wiz.widthHint' : k === 'height' ? 'wiz.heightHint' : 'wiz.depthHint')}</span>
                    </div>
                  ))}
                </div>
                {a.type === 'corner' && (
                  <div className="max-w-[12rem]">
                    <DimensionInput
                      label={t('corner.width')}
                      value={a.wingWidth}
                      min={a.depth + 300}
                      max={LIMITS.width.max}
                      step={10}
                      unit={mm}
                      onCommit={(v) => set({ wingWidth: Math.round(v) })}
                    />
                  </div>
                )}
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm leading-snug text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                  <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <rect x="6" y="14" width="30" height="20" rx="3" />
                    <circle cx="21" cy="24" r="5" />
                    <path d="M36 28h8v4h-8M40 28v-3M44 28v-3" />
                  </svg>
                  <p>{t('wiz.measure')}</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div role="radiogroup" aria-label={t('wiz.q3')} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {FILLS.map(({ fill, icon }) => {
                  const on = a.fill === fill;
                  return (
                    <button
                      key={fill}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ fill })}
                      className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-950' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <span className={on ? 'text-blue-600' : 'text-slate-500'}>
                        <Pictogram d={icon} size={40} />
                      </span>
                      <span className="font-medium">{t(fillLabel[fill])}</span>
                      <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">{t(fillHint[fill])}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-5">
                <BigSwatches
                  label={t('wiz.body')}
                  value={a.body}
                  materials={bodyMaterials()}
                  onChange={(body) => set({ body })}
                  help={<HelpTip term={t('left.body')} text={t('help.ldsp')} />}
                />
                <BigSwatches label={t('wiz.fronts')} value={a.facade} materials={facadeMaterials()} onChange={(facade) => set({ facade })} />
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-4">
                <label className="flex max-w-md flex-col gap-1">
                  <span className="text-xs text-slate-500">{t('wiz.name')}</span>
                  <input className="input" value={a.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && create()} />
                </label>
                <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-slate-500">{t('wiz.sum.type')}</dt>
                  <dd>{t(`type.${a.type}`)}</dd>
                  <dt className="text-slate-500">{t('wiz.sum.size')}</dt>
                  <dd className="tabular-nums">
                    {preview.width}×{preview.height}×{preview.depth} {mm}
                    {preview.corner ? ` + ${preview.corner.width} ${mm}` : ''}
                  </dd>
                  <dt className="text-slate-500">{t('wiz.sum.fill')}</dt>
                  <dd>{t(fillLabel[a.fill])}</dd>
                  <dt className="text-slate-500">{t('wiz.sum.sections')}</dt>
                  <dd>{preview.sections.length + (preview.corner?.sections.length ?? 0)}</dd>
                  <dt className="text-slate-500">{t('wiz.sum.doors')}</dt>
                  <dd>{preview.doors.kind === 'none' ? 0 : preview.doors.count + (preview.corner?.doorCount ?? 0)}</dd>
                </dl>
                <p className="max-w-md rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">{t('wiz.sum.next')}</p>
              </div>
            )}
          </div>

          <aside className="hidden border-l border-slate-200 bg-slate-50 p-4 md:block dark:border-slate-800 dark:bg-slate-950/50" aria-hidden>
            <MiniPreview w={preview} className="h-72 w-full" />
            <p className="mt-2 text-center text-xs tabular-nums text-slate-500">
              {preview.width}×{preview.height}×{preview.depth} {mm}
            </p>
          </aside>
        </div>

        {/* Навигация */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={step === 0}>
            ← {t('wiz.back')}
          </button>
          {!last && (
            <button type="button" className="btn ml-auto border-transparent text-slate-500 dark:border-transparent" onClick={create}>
              {t('wiz.skip')}
            </button>
          )}
          <button type="button" className={`btn btn-primary ${last ? 'ml-auto' : ''}`} onClick={() => (last ? create() : setStep(step + 1))} autoFocus>
            {last ? `✓ ${t('wiz.create')}` : `${t('wiz.next')} →`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
