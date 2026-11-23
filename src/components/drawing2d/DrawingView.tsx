import { useMemo, useState } from 'react';
import { useT } from '../../i18n/useT';
import { buildSheets } from '../../lib/drawing';
import { useWardrobe } from '../../store/wardrobeStore';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const BASE_WIDTH = 1000; // px при 100 %

const FONT_FACE = `@font-face{font-family:'PT Sans Narrow';font-weight:normal;src:url('${import.meta.env.BASE_URL}fonts/PTSansNarrow-Regular.ttf') format('truetype');font-display:swap}
@font-face{font-family:'PT Sans Narrow';font-weight:bold;src:url('${import.meta.env.BASE_URL}fonts/PTSansNarrow-Bold.ttf') format('truetype');font-display:swap}
.drawing-sheet>svg{display:block;width:100%;height:auto}`;

/** Предпросмотр листов чертежа — тот же SVG, что уходит в экспорт. */
export function DrawingView() {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const lang = useWardrobe((s) => s.lang);
  const sheet = useWardrobe((s) => s.sheet);
  const setSheet = useWardrobe((s) => s.setSheet);
  const [zoomIdx, setZoomIdx] = useState(2);
  const sheets = useMemo(() => buildSheets(w, t, lang), [w, t, lang]);
  const index = Math.min(Math.max(sheet, 1), sheets.length) - 1;
  const zoom = ZOOMS[zoomIdx];

  return (
    <div className="flex h-full w-full flex-col bg-slate-200 dark:bg-slate-800">
      <style>{FONT_FACE}</style>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-300 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
        <div role="tablist" aria-label={t('view.drawing')} className="flex gap-1">
          {sheets.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={index === i}
              className={`chip ${index === i ? 'chip-on' : ''}`}
              onClick={() => setSheet(i + 1)}
            >
              {t('view.sheet', { n: i + 1 })}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="chip"
            aria-label="−"
            disabled={zoomIdx === 0}
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
          >
            −
          </button>
          <button type="button" className="chip w-16 justify-center tabular-nums" onClick={() => setZoomIdx(2)}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="chip"
            aria-label="+"
            disabled={zoomIdx === ZOOMS.length - 1}
            onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}
          >
            +
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div
          role="tabpanel"
          aria-label={t('view.sheet', { n: index + 1 })}
          className="drawing-sheet mx-auto bg-white shadow-xl ring-1 ring-black/10"
          style={{ width: BASE_WIDTH * zoom, maxWidth: zoom <= 1 ? '100%' : undefined }}
          dangerouslySetInnerHTML={{ __html: sheets[index] }}
        />
      </div>
    </div>
  );
}
