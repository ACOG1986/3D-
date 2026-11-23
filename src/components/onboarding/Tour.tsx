import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MessageKey } from '../../i18n';
import { useT } from '../../i18n/useT';

const TOUR_KEY = 'wardrobe.tour.v1';

interface TourStep {
  /** Значение data-tour у подсвечиваемого элемента; null — по центру экрана. */
  target: string | null;
  title: MessageKey;
  text: MessageKey;
}

const STEPS: TourStep[] = [
  { target: null, title: 'tour.welcome.title', text: 'tour.welcome.text' },
  { target: 'catalog', title: 'tour.catalog.title', text: 'tour.catalog.text' },
  { target: 'scene', title: 'tour.scene.title', text: 'tour.scene.text' },
  { target: 'views', title: 'tour.views.title', text: 'tour.views.text' },
  { target: 'props', title: 'tour.props.title', text: 'tour.props.text' },
  { target: 'download', title: 'tour.download.title', text: 'tour.download.text' },
];

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* приватный режим — не критично */
  }
}

function findTarget(name: string | null): DOMRect | null {
  if (!name) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/** Шаги, цели которых сейчас видны (на планшете боковые панели скрыты). */
function visibleSteps(): TourStep[] {
  return STEPS.filter((s) => s.target === null || findTarget(s.target));
}

const POP_W = 340;
const GAP = 14;

/** Пошаговое знакомство с редактором: подсветка области и короткое пояснение. */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [steps, setSteps] = useState<TourStep[]>(STEPS);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [popH, setPopH] = useState(180);

  useEffect(() => {
    if (open) {
      setSteps(visibleSteps());
      setI(0);
    }
  }, [open]);

  const step = steps[i];
  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    setRect(step ? findTarget(step.target) : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure]);

  useLayoutEffect(() => {
    if (popRef.current) setPopH(popRef.current.offsetHeight);
    nextRef.current?.focus();
  }, [i, open, rect]);

  const finish = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, finish]);

  if (!open || !step) return null;
  const last = i === steps.length - 1;

  // Положение подсказки: справа, слева, снизу или сверху от цели — где поместится
  let left = (vp.w - POP_W) / 2;
  let top = (vp.h - popH) / 2;
  if (rect) {
    const pad = 8;
    if (rect.right + GAP + POP_W < vp.w - pad) {
      left = rect.right + GAP;
      top = rect.top + 16;
    } else if (rect.left - GAP - POP_W > pad) {
      left = rect.left - GAP - POP_W;
      top = rect.top + 16;
    } else if (rect.bottom + GAP + popH < vp.h - pad) {
      left = rect.left + rect.width / 2 - POP_W / 2;
      top = rect.bottom + GAP;
    } else {
      left = rect.left + rect.width / 2 - POP_W / 2;
      top = rect.top - GAP - popH;
    }
    // Большая цель (сцена): подсказку кладём внутрь, в верхний левый угол
    if (rect.width > vp.w * 0.45 && rect.height > vp.h * 0.4) {
      left = rect.left + 24;
      top = rect.top + 56;
    }
    left = Math.min(Math.max(pad, left), vp.w - POP_W - pad);
    top = Math.min(Math.max(pad, top), vp.h - popH - pad);
  }

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Затемнение с «окном» над целью */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-blue-500 transition-all duration-200"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/55" />
      )}
      {/* Клик по затемнению не закрывает тур случайно — только кнопки */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />
      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className="fixed rounded-xl bg-white p-4 text-slate-800 shadow-2xl dark:bg-slate-800 dark:text-slate-100"
        style={{ left, top, width: POP_W }}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 id="tour-title" className="text-base font-semibold">
            {t(step.title)}
          </h2>
          <span className="text-xs tabular-nums text-slate-400">{t('tour.step', { n: i + 1, total: steps.length })}</span>
        </div>
        <p id="tour-text" className="text-sm leading-snug text-slate-600 dark:text-slate-300">
          {t(step.text)}
        </p>
        <div className="mt-3 flex items-center gap-1" aria-hidden>
          {steps.map((s, k) => (
            <span key={s.title} className={`h-1.5 flex-1 rounded-full ${k <= i ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!last && (
            <button type="button" className="btn whitespace-nowrap border-transparent px-1.5 text-slate-500 dark:border-transparent" onClick={finish}>
              {t('tour.skip')}
            </button>
          )}
          {i > 0 && (
            <button type="button" className="btn ml-auto whitespace-nowrap px-2.5" onClick={() => setI(i - 1)}>
              ← {t('wiz.back')}
            </button>
          )}
          <button ref={nextRef} type="button" className={`btn btn-primary whitespace-nowrap ${i === 0 ? 'ml-auto' : ''}`} onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? t('tour.done') : `${t('tour.next')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
