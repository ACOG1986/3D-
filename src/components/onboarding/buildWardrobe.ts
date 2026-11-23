/**
 * Сборка модели шкафа из ответов мастера «Создать шкаф».
 * Чистая функция: только публичные помощники geometry.ts.
 */
import {
  availableSectionsWidth,
  carcassDims,
  clamp,
  createItem,
  createWardrobe,
  fitSectionWidths,
  LIMITS,
  normalizeWardrobe,
  uid,
} from '../../lib/geometry';
import type { Section, SectionItem, Wardrobe, WardrobeType } from '../../types/wardrobe';

export type FillPreset = 'hang' | 'shelves' | 'balanced';

export interface WizardAnswers {
  type: WardrobeType;
  width: number;
  height: number;
  depth: number;
  /** Ширина бокового крыла (только для углового шкафа). */
  wingWidth: number;
  fill: FillPreset;
  body: string;
  facade: string;
  name: string;
}

export interface SizePreset {
  key: 'hall' | 'bedroom' | 'walkin';
  width: number;
  height: number;
  depth: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { key: 'hall', width: 1200, height: 2400, depth: 450 },
  { key: 'bedroom', width: 1800, height: 2400, depth: 600 },
  { key: 'walkin', width: 2400, height: 2600, depth: 600 },
];

/** Максимальная ширина секции, при которой полки не прогибаются. */
const MAX_SECTION = 800;
const MIN_SECTION = 350;
const MAX_DOOR = 600;

const fixedShelf = (y: number): SectionItem => ({ ...createItem('shelf', y), fixed: true }) as SectionItem;

function shelves(from: number, to: number, step: number, t: number): SectionItem[] {
  const out: SectionItem[] = [];
  for (let y = from; y + t <= to - 120; y += step) out.push(createItem('shelf', y));
  return out;
}

/** Наполнение одной секции по выбранному сценарию. */
function fillSection(fill: FillPreset, index: number, count: number, innerH: number, t: number, slide: Wardrobe['defaultSlide']): SectionItem[] {
  const top = innerH >= 1700 ? Math.floor((innerH - 450) / 10) * 10 : null;
  const region = top ?? innerH;
  const items: SectionItem[] = top !== null ? [fixedShelf(top)] : [];
  const rod = () => (region >= 1000 ? [createItem('rod', region - 60)] : shelves(350, region, 350, t));
  const drawers = () => [createItem('drawer', 0, slide), createItem('drawer', 190, slide)];
  const middle = Math.floor(count / 2);

  if (fill === 'shelves') return [...items, ...shelves(350, region, 350, t)];

  if (fill === 'hang') {
    if (count >= 3 && index === middle) return [...items, ...shelves(300, region, 350, t)];
    if (count <= 2 && index === count - 1) return [...items, ...rod(), createItem('shelf', 300)];
    return [...items, ...rod()];
  }

  // balanced
  if (count === 1) return [...items, ...drawers(), createItem('shelf', 420), ...rod()];
  if (index === 0) return [...items, ...rod()];
  if (index === count - 1) return [...items, ...rod(), createItem('shelf', 300)];
  return [...items, ...drawers(), ...shelves(500, region, 330, t)];
}

function sectionsFor(w: Wardrobe, fill: FillPreset): Section[] {
  const d = carcassDims(w);
  let n = clamp(Math.ceil(d.innerWidth / MAX_SECTION), 1, 10);
  while (n > 1 && availableSectionsWidth(w, n) / n < MIN_SECTION) n -= 1;
  const avail = availableSectionsWidth(w, n);
  const widths = fitSectionWidths(Array(n).fill(avail / n), avail);
  return widths.map((width, i) => ({ id: uid('sec'), width, items: fillSection(fill, i, n, d.innerHeight, d.t, w.defaultSlide) }));
}

function swingDoors(span: number): number {
  return Math.max(1, Math.ceil(span / MAX_DOOR));
}

export function buildWardrobe(a: WizardAnswers): Wardrobe {
  const base = createWardrobe(a.type, a.name);
  const width = clamp(Math.round(a.width), LIMITS.width.min, LIMITS.width.max);
  const height = clamp(Math.round(a.height), LIMITS.height.min, LIMITS.height.max);
  const depth = clamp(Math.round(a.depth), LIMITS.depth.min, LIMITS.depth.max);
  let w: Wardrobe = {
    ...base,
    width,
    height,
    depth,
    bodyMaterial: a.body,
    doors: { ...base.doors, material: a.facade, overrides: [] },
  };
  w = { ...w, sections: sectionsFor(w, a.fill) };

  if (w.doors.kind === 'sliding') {
    w.doors = { ...w.doors, count: width > 2400 ? 3 : 2 };
  } else if (w.doors.kind !== 'none') {
    const span = a.type === 'corner' ? width - depth : width;
    w.doors = { ...w.doors, count: swingDoors(span) };
  }

  if (a.type === 'corner' && w.corner) {
    const wingWidth = clamp(Math.round(a.wingWidth), depth + 300, LIMITS.width.max);
    w.corner = { ...w.corner, width: wingWidth, doorCount: swingDoors(wingWidth) };
  }
  return normalizeWardrobe(w);
}

export function defaultAnswers(name: string): WizardAnswers {
  return {
    type: 'swing',
    width: 1800,
    height: 2400,
    depth: 600,
    wingWidth: 1400,
    fill: 'balanced',
    body: 'ldsp-white',
    facade: 'ldsp-oak-sonoma',
    name,
  };
}
