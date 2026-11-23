import { useMemo, useState } from 'react';
import { decimalSep, edgeLetters, formatIssue, formatNumber, hardwareName, partName } from '../../i18n';
import { useT } from '../../i18n/useT';
import { computeHardware, computePanels, computeSpec, edgeTotals, formatEdges, materialAreas, validate } from '../../lib/geometry';
import { materialName } from '../../lib/materials';
import { useWardrobe } from '../../store/wardrobeStore';

type Tab = 'spec' | 'hardware' | 'issues';

/** Живая спецификация, фурнитура и результаты проверки модели. */
export function BottomPanel() {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const lang = useWardrobe((s) => s.lang);
  const select = useWardrobe((s) => s.select);
  const [tab, setTab] = useState<Tab>('spec');
  const [open, setOpen] = useState(true);

  const panels = useMemo(() => computePanels(w), [w]);
  const spec = useMemo(() => computeSpec(panels), [panels]);
  const hardware = useMemo(() => computeHardware(w), [w]);
  const issues = useMemo(() => validate(w), [w]);
  const edges = useMemo(() => edgeTotals(panels), [panels]);
  const areas = useMemo(() => materialAreas(spec), [spec]);

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const parts = spec.reduce((a, r) => a + r.qty, 0);
  const area = areas.reduce((a, r) => a + r.area, 0);
  const edgeStr = Object.entries(edges)
    .map(([k, v]) => `${k.replace('.', decimalSep(lang))} ${t('mm')}: ${formatNumber(lang, v)} ${t('unit.m')}`)
    .join(', ');
  const letters = edgeLetters(t);

  const tabs: [Tab, string][] = [
    ['spec', `${t('bottom.spec')} (${parts})`],
    ['hardware', t('bottom.hardware')],
    ['issues', `${t('bottom.issues')}${issues.length ? ` (${issues.length})` : ''}`],
  ];

  return (
    <section className="flex min-h-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label={t('bottom.spec')}>
      <div className="flex items-center gap-1 px-2 py-1" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setOpen(true);
            }}
            className={`rounded px-2 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              tab === k && open ? 'bg-slate-200 dark:bg-slate-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            } ${k === 'issues' && errors ? 'text-red-600 dark:text-red-400' : k === 'issues' && warnings ? 'text-amber-600 dark:text-amber-400' : ''}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto hidden truncate text-[11px] text-slate-500 md:inline">
          {t('bottom.summary', { parts, area: formatNumber(lang, area), edge: edgeStr || '—' })}
        </span>
        <button type="button" className="chip ml-2" aria-expanded={open} onClick={() => setOpen(!open)} aria-label="toggle">
          {open ? '▾' : '▴'}
        </button>
      </div>
      {open && (
        <div className="max-h-44 min-h-0 overflow-auto px-2 pb-2 text-xs">
          {tab === 'spec' && (
            <table className="w-full border-collapse tabular-nums">
              <thead className="sticky top-0 bg-white text-left text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-1 py-1 font-medium">{t('spec.pos')}</th>
                  <th className="px-1 py-1 font-medium">{t('spec.name')}</th>
                  <th className="px-1 py-1 text-right font-medium">{t('spec.qty')}</th>
                  <th className="px-1 py-1 font-medium">{t('spec.size')}</th>
                  <th className="px-1 py-1 font-medium">{t('spec.material')}</th>
                  <th className="px-1 py-1 font-medium">{t('spec.edge')}</th>
                </tr>
              </thead>
              <tbody>
                {spec.map((r) => (
                  <tr key={r.pos} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-1 py-0.5">{r.pos}</td>
                    <td className="px-1 py-0.5">{partName(t, r.name)}</td>
                    <td className="px-1 py-0.5 text-right">{r.qty}</td>
                    <td className="px-1 py-0.5">
                      {Math.round(r.length)}×{Math.round(r.width)}×{r.thickness}
                    </td>
                    <td className="px-1 py-0.5">{materialName(r.material, lang)}</td>
                    <td className="px-1 py-0.5">{formatEdges(r.edges, letters, decimalSep(lang))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'hardware' && (
            <table className="w-full border-collapse tabular-nums">
              <tbody>
                {hardware.map((h, i) => (
                  <tr key={i} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
                    <td className="px-1 py-0.5">{hardwareName(t, h)}</td>
                    <td className="w-20 px-1 py-0.5 text-right">{formatNumber(lang, h.qty)}</td>
                    <td className="w-14 px-1 py-0.5">{t(`unit.${h.unit}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'issues' &&
            (issues.length === 0 ? (
              <p className="py-2 text-emerald-600 dark:text-emerald-400">✓ {t('bottom.noIssues')}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {issues.map((i, k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => i.ref && select(i.ref)}
                      className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
                    >
                      <span aria-hidden className={i.severity === 'error' ? 'text-red-600' : 'text-amber-500'}>
                        {i.severity === 'error' ? '⛔' : '⚠'}
                      </span>
                      <span>{formatIssue(t, i)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </section>
  );
}
