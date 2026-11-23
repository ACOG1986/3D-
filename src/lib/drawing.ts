/**
 * Генерация технического чертежа (A3, альбомная) в виде SVG-строк.
 * Всё строится из модели Wardrobe через geometry.ts — без DOM,
 * поэтому одна и та же функция используется для экрана, SVG/PNG/PDF и тестов.
 *
 * Единицы SVG — миллиметры листа (viewBox 0 0 420 297).
 * Оформление упрощённо по ГОСТ 2.104 (рамка, основная надпись) и 2.301 (формат, масштабы).
 */
import { decimalSep, edgeLetters, formatNumber, hardwareName, LOCALE, partName, type Lang, type MessageKey, type TFunction } from '../i18n';
import type { Door, Panel, Wardrobe } from '../types/wardrobe';
import {
  carcassDims,
  computeCutting,
  computeDoors,
  computeHardware,
  computePanels,
  computeSpec,
  doorZ,
  edgeTotals,
  formatEdges,
  itemExtent,
  layoutSections,
  materialAreas,
  type CutSheet,
} from './geometry';
import { materialName } from './materials';

export const SHEET_W = 420;
export const SHEET_H = 297;
export const SHEETS_COUNT = 3;
export const STANDARD_SCALES = [5, 10, 15, 20, 25, 50] as const;
export const DRAWING_FONT = "'PT Sans Narrow', 'Arial Narrow', Arial, sans-serif";

/* Рамка: поле подшивки 20 мм слева, 5 мм с остальных сторон. */
const FRAME = { x1: 20, y1: 5, x2: 415, y2: 292 };
/* Основная надпись 185×55 в правом нижнем углу. */
const STAMP = { w: 185, h: 55, x: FRAME.x2 - 185, y: FRAME.y2 - 55 };

const LINE_MAIN = 0.5;
const LINE_THIN = 0.18;
const INK = '#000';

/* ------------------------------------------------------------------ */
/* SVG-примитивы                                                        */
/* ------------------------------------------------------------------ */

export function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

type Attrs = Record<string, string | number | undefined>;
function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? f(v) : esc(v as string)}"`)
    .join(' ');
}

function line(x1: number, y1: number, x2: number, y2: number, w = LINE_THIN, extra: Attrs = {}): string {
  return `<line ${attrs({ x1, y1, x2, y2, stroke: INK, 'stroke-width': w, ...extra })}/>`;
}

function rect(x: number, y: number, w: number, h: number, stroke = LINE_MAIN, fill = 'none', extra: Attrs = {}): string {
  return `<rect ${attrs({ x, y, width: Math.max(w, 0.01), height: Math.max(h, 0.01), fill, stroke: INK, 'stroke-width': stroke, ...extra })}/>`;
}

interface TextOpts {
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  bold?: boolean;
  rotate?: number;
}
function text(x: number, y: number, s: string | number, o: TextOpts = {}): string {
  const size = o.size ?? 3.5;
  const tr = o.rotate ? ` transform="rotate(${o.rotate} ${f(x)} ${f(y)})"` : '';
  return `<text ${attrs({
    x,
    y,
    'font-size': size,
    'text-anchor': o.anchor ?? 'start',
    'font-weight': o.bold ? 'bold' : undefined,
    fill: INK,
  })}${tr}>${esc(s)}</text>`;
}

/** Оценка ширины текста узкого шрифта, мм. */
export function textWidth(s: string, size: number): number {
  return s.length * size * 0.43;
}

function fitText(s: string, size: number, maxW: number): string {
  if (textWidth(s, size) <= maxW) return s;
  const n = Math.max(1, Math.floor(maxW / (size * 0.43)) - 1);
  return s.slice(0, n) + '…';
}

function arrow(x: number, y: number, dir: 'l' | 'r' | 'u' | 'd'): string {
  const L = 2.5;
  const W = 0.6;
  const pts =
    dir === 'l'
      ? [[x, y], [x + L, y - W], [x + L, y + W]]
      : dir === 'r'
        ? [[x, y], [x - L, y - W], [x - L, y + W]]
        : dir === 'u'
          ? [[x, y], [x - W, y + L], [x + W, y + L]]
          : [[x, y], [x - W, y - L], [x + W, y - L]];
  return `<polygon points="${pts.map((p) => p.map(f).join(',')).join(' ')}" fill="${INK}" stroke="none"/>`;
}

function tick(x: number, y: number): string {
  return line(x - 0.9, y + 0.9, x + 0.9, y - 0.9, 0.35);
}

const DIM_TEXT = 3;

/**
 * Горизонтальный размер между x1 и x2 на уровне y.
 * fromY — откуда тянуть выносные линии (край детали).
 */
function dimH(x1: number, x2: number, y: number, fromY: number | null, value: number, size = DIM_TEXT): string {
  const out: string[] = [];
  const span = Math.abs(x2 - x1);
  if (span < 0.3) return '';
  const dir = fromY === null ? 0 : Math.sign(y - fromY);
  if (fromY !== null) {
    out.push(line(x1, fromY + dir * 1, x1, y + dir * 2));
    out.push(line(x2, fromY + dir * 1, x2, y + dir * 2));
  }
  out.push(line(x1, y, x2, y));
  if (span >= 7) out.push(arrow(Math.min(x1, x2), y, 'l'), arrow(Math.max(x1, x2), y, 'r'));
  else out.push(tick(x1, y), tick(x2, y));
  const label = String(Math.round(value));
  const tw = textWidth(label, size);
  if (tw + 1.5 <= span) out.push(text((x1 + x2) / 2, y - 0.8, label, { size, anchor: 'middle' }));
  else out.push(text(Math.max(x1, x2) + 1, y - 0.8, label, { size }));
  return out.join('');
}

/** Вертикальный размер между y1 и y2 на абсциссе x (текст повернут на −90°). */
function dimV(y1: number, y2: number, x: number, fromX: number | null, value: number, size = DIM_TEXT): string {
  const out: string[] = [];
  const span = Math.abs(y2 - y1);
  if (span < 0.3) return '';
  const dir = fromX === null ? 0 : Math.sign(x - fromX);
  if (fromX !== null) {
    out.push(line(fromX + dir * 1, y1, x + dir * 2, y1));
    out.push(line(fromX + dir * 1, y2, x + dir * 2, y2));
  }
  out.push(line(x, y1, x, y2));
  if (span >= 7) out.push(arrow(x, Math.min(y1, y2), 'u'), arrow(x, Math.max(y1, y2), 'd'));
  else out.push(tick(x, y1), tick(x, y2));
  const label = String(Math.round(value));
  const tw = textWidth(label, size);
  const cy = (y1 + y2) / 2;
  if (tw + 1.5 <= span) out.push(text(x - 0.8, cy, label, { size, anchor: 'middle', rotate: -90 }));
  else out.push(text(x - 0.8, Math.min(y1, y2) - 1, label, { size, anchor: 'start', rotate: -90 }));
  return out.join('');
}

/* ------------------------------------------------------------------ */
/* Лист, рамка, основная надпись                                        */
/* ------------------------------------------------------------------ */

function svgDoc(body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}mm" height="${SHEET_H}mm" viewBox="0 0 ${SHEET_W} ${SHEET_H}" ` +
    `font-family="${esc(DRAWING_FONT)}">` +
    `<rect x="0" y="0" width="${SHEET_W}" height="${SHEET_H}" fill="#ffffff"/>` +
    body +
    `</svg>`
  );
}

interface StampInfo {
  doc: string;
  project: string;
  scale: string;
  sheet: number;
  date: string;
  dims: string;
}

function frame(t: TFunction, s: StampInfo): string {
  const o: string[] = [];
  o.push(rect(FRAME.x1, FRAME.y1, FRAME.x2 - FRAME.x1, FRAME.y2 - FRAME.y1, 0.7));
  const { x, y, w, h } = STAMP;
  o.push(rect(x, y, w, h, 0.7, '#ffffff'));
  // Левая колонка: подписи
  const lw = 65;
  o.push(line(x + lw, y, x + lw, y + h, LINE_MAIN));
  const rows: [string, string][] = [
    [t('dr.stamp.dev'), ''],
    [t('dr.stamp.check'), ''],
    [t('dr.stamp.date'), s.date],
    [t('dr.stamp.dims'), s.dims],
  ];
  const rh = h / 5;
  for (let i = 1; i < 5; i++) o.push(line(x, y + rh * i, x + lw, y + rh * i, LINE_THIN));
  o.push(line(x + 20, y, x + 20, y + rh * 4, LINE_THIN));
  rows.forEach(([k, v], i) => {
    o.push(text(x + 1.5, y + rh * i + 7, fitText(k, 3, 18), { size: 3 }));
    o.push(text(x + 22, y + rh * i + 7, fitText(v, 3, lw - 23), { size: 3 }));
  });
  o.push(text(x + lw / 2, y + rh * 4 + 7, fitText(t('dr.stamp.org'), 3, lw - 3), { size: 3, anchor: 'middle' }));
  // Средняя колонка: наименование документа и проекта
  const mw = 70;
  const mx = x + lw;
  o.push(line(mx + mw, y, mx + mw, y + h, LINE_MAIN));
  o.push(text(mx + mw / 2, y + 20, fitText(s.doc, 5, mw - 4), { size: 5, anchor: 'middle', bold: true }));
  o.push(line(mx, y + 30, mx + mw, y + 30, LINE_THIN));
  o.push(text(mx + mw / 2, y + 44, fitText(s.project, 4.5, mw - 4), { size: 4.5, anchor: 'middle' }));
  // Правая колонка: масштаб, лист, листов
  const rx = mx + mw;
  const rw = w - lw - mw;
  const cw = rw / 3;
  o.push(line(rx, y + 8, rx + rw, y + 8, LINE_THIN));
  o.push(line(rx, y + 18, rx + rw, y + 18, LINE_MAIN));
  o.push(line(rx + cw, y, rx + cw, y + 18, LINE_THIN));
  o.push(line(rx + 2 * cw, y, rx + 2 * cw, y + 18, LINE_THIN));
  const heads = [t('dr.stamp.scale'), t('dr.stamp.sheet'), t('dr.stamp.sheets')];
  const vals = [s.scale, String(s.sheet), String(SHEETS_COUNT)];
  heads.forEach((hd, i) => {
    o.push(text(rx + cw * i + cw / 2, y + 5.8, fitText(hd, 2.8, cw - 1), { size: 2.8, anchor: 'middle' }));
    o.push(text(rx + cw * i + cw / 2, y + 15, vals[i], { size: 4, anchor: 'middle' }));
  });
  o.push(text(rx + rw / 2, y + 40, fitText(s.project, 3.5, rw - 4), { size: 3.5, anchor: 'middle' }));
  return o.join('');
}

/* ------------------------------------------------------------------ */
/* Лист 1: виды                                                         */
/* ------------------------------------------------------------------ */

interface Layout1 {
  s: number;
  front: { x: number; y: number };
  facade: { x: number; y: number };
  side: { x: number; y: number };
  top: { x: number; y: number };
  notes: { x: number; y: number };
}

function layoutSheet1(w: Wardrobe): Layout1 {
  for (const s of STANDARD_SCALES) {
    const W = w.width / s;
    const H = w.height / s;
    const D = w.depth / s;
    const fx = FRAME.x1 + 30;
    const fy = 36;
    const facadeX = fx + W + 26;
    const sideX = facadeX + W + 24;
    const right = sideX + D + 8;
    const topY = fy + H + 16;
    const bottom = topY + D + 14;
    // Вид сверху слева от основной надписи
    const fitsBottom = bottom <= FRAME.y2 - 3 && fx + W + 14 <= STAMP.x;
    const fitsRight = right <= FRAME.x2 - 3 && fy + H + 6 <= STAMP.y;
    if (fitsBottom && fitsRight) {
      const notesX = facadeX;
      const notesY = fy + H + 8;
      return { s, front: { x: fx, y: fy }, facade: { x: facadeX, y: fy }, side: { x: sideX, y: fy }, top: { x: fx, y: topY }, notes: { x: notesX, y: notesY } };
    }
  }
  const s = 50;
  const W = w.width / s;
  const H = w.height / s;
  const fx = FRAME.x1 + 30;
  return {
    s,
    front: { x: fx, y: 36 },
    facade: { x: fx + W + 26, y: 36 },
    side: { x: fx + 2 * W + 50, y: 36 },
    top: { x: fx, y: 36 + H + 16 },
    notes: { x: fx + W + 26, y: 36 + H + 14 },
  };
}

function viewTitle(x: number, y: number, s: string): string {
  return text(x, y, s, { size: 3.5 }) + line(x, y + 0.8, x + s.length * 3.5 * 0.38, y + 0.8, LINE_THIN);
}

function frontView(w: Wardrobe, panels: Panel[], L: Layout1): string {
  const { s } = L;
  const X = (x: number) => L.front.x + x / s;
  const Y = (y: number) => L.front.y + (w.height - y) / s;
  const d = carcassDims(w);
  const o: string[] = [];
  const hiddenNames = new Set(['back', 'plinthBack', 'drawerSide', 'drawerFrontBack', 'drawerBottom']);
  for (const p of panels) {
    if (p.group === 'facade' || hiddenNames.has(p.name)) continue;
    const x = X(p.x);
    const y = Y(p.y + p.sy);
    const pw = p.sx / s;
    const ph = p.sy / s;
    if (p.name === 'rod' || p.name === 'pantograph') {
      const cy = Y(p.y + p.sy / 2);
      o.push(line(x, cy, x + pw, cy, 0.35, { 'stroke-dasharray': '3 1.5' }));
      if (p.name === 'pantograph') {
        o.push(line(x + 1, cy, x + 1, cy + 120 / s, LINE_THIN), line(x + pw - 1, cy, x + pw - 1, cy + 120 / s, LINE_THIN));
      }
      continue;
    }
    if (p.name === 'basket') {
      o.push(rect(x, y, pw, ph, 0.25));
      o.push(line(x, y, x + pw, y + ph, LINE_THIN), line(x + pw, y, x, y + ph, LINE_THIN));
      continue;
    }
    o.push(rect(x, y, pw, ph, p.name === 'drawerFront' ? 0.35 : LINE_MAIN, '#ffffff'));
  }

  // Размеры: габаритная ширина и цепочка секций сверху
  const top = Y(w.height);
  const layout = layoutSections(w);
  o.push(dimH(X(0), X(w.width), top - 14, top, w.width));
  for (const sl of layout) o.push(dimH(X(sl.x), X(sl.x + sl.width), top - 7, top, sl.width));
  // Слева: габаритная высота и цоколь
  const left = X(0);
  o.push(dimV(Y(0), Y(w.height), left - 16, left, w.height));
  if (w.plinth.enabled) {
    o.push(dimV(Y(0), Y(d.plinthH), left - 8, left, d.plinthH));
    o.push(dimV(Y(d.plinthH), Y(w.height), left - 8, left, w.height - d.plinthH));
  }
  // Внутри секций — цепочка просветов между элементами
  for (const sl of layout) {
    const sec = w.sections[sl.index];
    const solid = sec.items
      .filter((i) => i.kind === 'shelf' || i.kind === 'drawer' || i.kind === 'basket')
      .map((i) => itemExtent(i, d.t))
      .sort((a, b) => a.bottom - b.bottom);
    const pts: number[] = [0];
    for (const e of solid) pts.push(e.bottom, e.top);
    pts.push(d.innerHeight);
    const x = X(sl.x) + 3.2;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const a = pts[i];
      const b = pts[i + 1];
      if (b - a <= 0 || (b - a) / s < 2.5) continue;
      o.push(dimV(Y(d.innerBottom + a), Y(d.innerBottom + b), x, null, b - a, 2.5));
    }
  }
  return o.join('');
}

function doorMarks(door: Door, X: (x: number) => number, Y: (y: number) => number): string {
  const x1 = X(door.x);
  const x2 = X(door.x + door.width);
  const y1 = Y(door.y + door.height);
  const y2 = Y(door.y);
  const dash = { 'stroke-dasharray': '2 1' };
  if (door.kind === 'swing') {
    // Треугольник открывания: вершина на стороне петель
    const hx = door.hingeSide === 'left' ? x1 : x2;
    const ox = door.hingeSide === 'left' ? x2 : x1;
    const my = (y1 + y2) / 2;
    const hy = my;
    const handle = line(ox + (door.hingeSide === 'left' ? -2 : 2), my - 3, ox + (door.hingeSide === 'left' ? -2 : 2), my + 3, 0.5);
    return line(ox, y1, hx, hy, LINE_THIN, dash) + line(ox, y2, hx, hy, LINE_THIN, dash) + handle;
  }
  if (door.kind === 'lift') {
    const mx = (x1 + x2) / 2;
    return line(x1, y2, mx, y1, LINE_THIN, dash) + line(x2, y2, mx, y1, LINE_THIN, dash);
  }
  // Купе: стрелка «туда-обратно»
  const my = (y1 + y2) / 2;
  const mx = (x1 + x2) / 2;
  const a = Math.min(8, (x2 - x1) / 4);
  return line(mx - a, my, mx + a, my, 0.25) + arrow(mx - a, my, 'l') + arrow(mx + a, my, 'r');
}

function facadeView(w: Wardrobe, doors: Door[], L: Layout1): string {
  const { s } = L;
  const X = (x: number) => L.facade.x + x / s;
  const Y = (y: number) => L.facade.y + (w.height - y) / s;
  const o: string[] = [];
  o.push(rect(X(0), Y(w.height), w.width / s, w.height / s, LINE_THIN));
  const ordered = [...doors].sort((a, b) => (a.track ?? 0) - (b.track ?? 0));
  for (const door of ordered) {
    o.push(rect(X(door.x), Y(door.y + door.height), door.width / s, door.height / s, LINE_MAIN, '#ffffff'));
    o.push(doorMarks(door, X, Y));
  }
  if (doors.length === 0) return o.join('');
  const top = Y(w.height);
  if (doors[0].kind === 'sliding') {
    const d0 = doors[0];
    o.push(dimH(X(d0.x), X(d0.x + d0.width), top - 7, Y(d0.y + d0.height), d0.width));
  } else {
    for (const door of doors) o.push(dimH(X(door.x), X(door.x + door.width), top - 7, Y(door.y + door.height), door.width));
  }
  const d0 = doors[0];
  const right = X(w.width);
  o.push(dimV(Y(d0.y), Y(d0.y + d0.height), right + 8, right, d0.height));
  return o.join('');
}

function sideView(w: Wardrobe, panels: Panel[], L: Layout1): string {
  const { s } = L;
  const Z = (z: number) => L.side.x + z / s;
  const Y = (y: number) => L.side.y + (w.height - y) / s;
  const d = carcassDims(w);
  const o: string[] = [];
  const layout = layoutSections(w);
  const sec = layout[0];
  const xc = sec ? sec.x + sec.width / 2 : w.width / 2;
  // Боковина за секущей плоскостью — тонкий контур
  const side = panels.find((p) => p.name === 'side');
  if (side) o.push(rect(Z(side.z), Y(side.y + side.sy), side.sz / s, side.sy / s, 0.3));
  for (const p of panels) {
    if (p.name === 'side') continue;
    if (!(p.x <= xc && xc <= p.x + p.sx)) continue;
    const z = Z(p.z);
    const y = Y(p.y + p.sy);
    if (p.name === 'rod' || p.name === 'pantograph') {
      o.push(`<circle ${attrs({ cx: Z(p.z + p.sz / 2), cy: Y(p.y + p.sy / 2), r: Math.max(0.6, 12.5 / s), fill: 'none', stroke: INK, 'stroke-width': 0.3 })}/>`);
      continue;
    }
    if (p.name === 'basket') {
      o.push(rect(z, y, p.sz / s, p.sy / s, LINE_THIN, 'none', { 'stroke-dasharray': '1.5 1' }));
      continue;
    }
    // Разрезанные детали — серая заливка
    o.push(rect(z, y, p.sz / s, p.sy / s, 0.3, p.group === 'facade' ? '#ffffff' : '#d9d9d9'));
  }
  const top = Y(w.height);
  o.push(dimH(Z(0), Z(w.depth), top - 14, top, w.depth));
  const inner = d.bt + d.interiorDepth;
  o.push(dimH(Z(0), Z(inner), top - 7, top, inner));
  if (w.depth - inner > 0) o.push(dimH(Z(inner), Z(w.depth), top - 7, top, w.depth - inner));
  return o.join('');
}

function topView(w: Wardrobe, panels: Panel[], doors: Door[], L: Layout1): string {
  const { s } = L;
  const X = (x: number) => L.top.x + x / s;
  const Z = (z: number) => L.top.y + z / s;
  const d = carcassDims(w);
  const o: string[] = [];
  o.push(rect(X(0), Z(d.bt), w.width / s, d.panelDepth / s, LINE_MAIN, '#ffffff'));
  if (d.hasBack) o.push(rect(X(2), Z(0), (w.width - 4) / s, Math.max(d.bt / s, 0.15), 0.3));
  for (const p of panels) {
    if (p.name === 'divider') o.push(rect(X(p.x), Z(p.z), p.sx / s, p.sz / s, 0.25, 'none', { 'stroke-dasharray': '1.5 1' }));
    if (p.name === 'side') o.push(line(X(p.x + (p.x === 0 ? p.sx : 0)), Z(p.z), X(p.x + (p.x === 0 ? p.sx : 0)), Z(p.z + p.sz), LINE_THIN, { 'stroke-dasharray': '1.5 1' }));
  }
  for (const door of doors) {
    const z = doorZ(w, door);
    o.push(rect(X(door.x), Z(z), door.width / s, door.thickness / s, 0.35, '#ffffff'));
  }
  const bottom = Z(w.depth);
  o.push(dimH(X(0), X(w.width), bottom + 9, bottom, w.width));
  const right = X(w.width);
  o.push(dimV(Z(0), Z(w.depth), right + 8, right, w.depth));
  return o.join('');
}

function sheet1(w: Wardrobe, t: TFunction, lang: Lang, stamp: Omit<StampInfo, 'sheet' | 'doc' | 'scale'>): string {
  const L = layoutSheet1(w);
  const panels = computePanels(w);
  const doors = computeDoors(w);
  const o: string[] = [];
  o.push(viewTitle(L.front.x, 13, t('dr.front')));
  o.push(frontView(w, panels, L));
  o.push(viewTitle(L.facade.x, 13, t('dr.facades')));
  o.push(facadeView(w, doors, L));
  o.push(viewTitle(L.side.x, 13, t('dr.side')));
  o.push(sideView(w, panels, L));
  o.push(viewTitle(L.top.x, L.top.y - 3, t('dr.top')));
  o.push(topView(w, panels, doors, L));

  // Технические требования
  const notes = [
    t('dr.note1'),
    t('dr.note2', { body: materialName(w.bodyMaterial, lang), t: w.boardThickness }),
    t('dr.note3', { v: formatNumber(lang, w.edge.visible, 1), h: formatNumber(lang, w.edge.hidden, 1) }),
    carcassDims(w).hasBack ? t('dr.note4', { back: materialName(w.backMaterial, lang), bt: w.backThickness }) : '',
  ].filter(Boolean);
  const nx = L.notes.x;
  // Блок требований заканчивается над основной надписью, если помещается
  const blockH = 4 + notes.length * 5;
  let ny = Math.max(L.notes.y, Math.min(L.notes.y + 6, STAMP.y - 4 - blockH)) + 4;
  o.push(text(nx, ny, t('dr.notes'), { size: 3.5, bold: true }));
  for (const n of notes) {
    ny += 5;
    const limit = ny > STAMP.y - 1 ? STAMP.x - nx - 3 : FRAME.x2 - nx - 4;
    o.push(text(nx, ny, fitText(n, 3, limit), { size: 3 }));
  }
  o.push(frame(t, { ...stamp, doc: t('dr.stamp.doc'), scale: `1:${L.s}`, sheet: 1 }));
  return svgDoc(o.join(''));
}

/* ------------------------------------------------------------------ */
/* Лист 2: спецификация и фурнитура                                     */
/* ------------------------------------------------------------------ */

interface Col {
  title: string;
  w: number;
  anchor?: 'start' | 'middle' | 'end';
}

function table(x: number, y: number, cols: Col[], rows: string[][], maxH: number, baseRow = 6): { svg: string; height: number } {
  const headH = 8;
  const rowH = rows.length > 0 ? Math.min(baseRow, Math.max(3.2, (maxH - headH) / rows.length)) : baseRow;
  const size = Math.min(3, rowH * 0.55);
  const width = cols.reduce((a, c) => a + c.w, 0);
  const height = headH + rows.length * rowH;
  const o: string[] = [];
  o.push(rect(x, y, width, height, LINE_MAIN));
  o.push(line(x, y + headH, x + width, y + headH, LINE_MAIN));
  let cx = x;
  cols.forEach((c, i) => {
    if (i > 0) o.push(line(cx, y, cx, y + height, LINE_THIN));
    o.push(text(cx + c.w / 2, y + 5.3, fitText(c.title, 3, c.w - 1), { size: 3, anchor: 'middle', bold: true }));
    cx += c.w;
  });
  rows.forEach((r, ri) => {
    const ry = y + headH + ri * rowH;
    if (ri > 0) o.push(line(x, ry, x + width, ry, LINE_THIN));
    let px = x;
    r.forEach((cell, ci) => {
      const c = cols[ci];
      const a = c.anchor ?? 'start';
      const tx = a === 'middle' ? px + c.w / 2 : a === 'end' ? px + c.w - 1.2 : px + 1.2;
      o.push(text(tx, ry + rowH * 0.5 + size * 0.36, fitText(cell, size, c.w - 2), { size, anchor: a }));
      px += c.w;
    });
  });
  return { svg: o.join(''), height };
}

function sheet2(w: Wardrobe, t: TFunction, lang: Lang, stamp: Omit<StampInfo, 'sheet' | 'doc' | 'scale'>): string {
  const panels = computePanels(w);
  const spec = computeSpec(panels);
  const hw = computeHardware(w);
  const letters = edgeLetters(t);
  const dec = decimalSep(lang);
  const o: string[] = [];

  const sx = FRAME.x1 + 5;
  o.push(viewTitle(sx, 13, t('dr.spec')));
  const specCols: Col[] = [
    { title: t('spec.pos'), w: 11, anchor: 'middle' },
    { title: t('spec.name'), w: 52 },
    { title: t('spec.qty'), w: 11, anchor: 'middle' },
    { title: t('spec.size'), w: 32, anchor: 'middle' },
    { title: t('spec.material'), w: 50 },
    { title: t('spec.edge'), w: 49 },
  ];
  const specRows = spec.map((r) => [
    String(r.pos),
    partName(t, r.name),
    String(r.qty),
    `${Math.round(r.length)}×${Math.round(r.width)}×${formatNumber(lang, r.thickness, 1)}`,
    materialName(r.material, lang),
    formatEdges(r.edges, letters, dec),
  ]);
  o.push(table(sx, 17, specCols, specRows, FRAME.y2 - 5 - 17).svg);

  const hx = STAMP.x + 5;
  o.push(viewTitle(hx, 13, t('dr.hardware')));
  const hwCols: Col[] = [
    { title: t('spec.pos'), w: 10, anchor: 'middle' },
    { title: t('spec.name'), w: 118 },
    { title: t('spec.qty'), w: 16, anchor: 'end' },
    { title: t('spec.unit'), w: 14, anchor: 'middle' },
  ];
  const hwRows = hw.map((h, i) => [String(i + 1), hardwareName(t, h), formatNumber(lang, h.qty, 2), t(`unit.${h.unit}` as MessageKey)]);
  const totals: string[] = [];
  for (const [th, m] of Object.entries(edgeTotals(panels)).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    totals.push(t('spec.totalEdge', { t: formatNumber(lang, Number(th), 1), m: formatNumber(lang, m, 2) }));
  }
  for (const a of materialAreas(spec)) totals.push(t('spec.area', { material: materialName(a.material, lang), area: formatNumber(lang, a.area, 2) }));
  const totalsH = totals.length * 4.5 + 6;
  const hwTable = table(hx, 17, hwCols, hwRows, STAMP.y - 17 - totalsH - 4);
  o.push(hwTable.svg);
  let ty = 17 + hwTable.height + 6;
  for (const line_ of totals) {
    o.push(text(hx, ty, fitText(line_, 3, 158), { size: 3 }));
    ty += 4.5;
  }
  o.push(frame(t, { ...stamp, doc: t('dr.stamp.docSpec'), scale: '—', sheet: 2 }));
  return svgDoc(o.join(''));
}

/* ------------------------------------------------------------------ */
/* Лист 3: раскрой                                                      */
/* ------------------------------------------------------------------ */

function cutSheetSvg(cs: CutSheet, x: number, y: number, maxW: number, maxH: number, t: TFunction, lang: Lang): string {
  const k = Math.min(maxW / cs.length, (maxH - 6) / cs.width);
  const o: string[] = [];
  o.push(
    text(
      x,
      y + 3,
      fitText(
        t('dr.sheetInfo', {
          n: cs.index,
          material: materialName(cs.material, lang),
          l: cs.length,
          w: cs.width,
          usage: formatNumber(lang, cs.usage, 1),
        }),
        3,
        maxW,
      ),
      { size: 3 },
    ),
  );
  const oy = y + 6;
  o.push(rect(x, oy, cs.length * k, cs.width * k, 0.35, '#e5e5e5'));
  for (const p of cs.placements) {
    const px = x + p.x * k;
    const py = oy + p.y * k;
    const pw = p.w * k;
    const ph = p.h * k;
    o.push(rect(px, py, pw, ph, 0.2, '#ffffff'));
    const size = Math.min(3, ph * 0.7, pw * 0.5);
    if (size >= 1.2) o.push(text(px + pw / 2, py + ph / 2 + size * 0.36, p.label, { size, anchor: 'middle' }));
  }
  return o.join('');
}

function sheet3(w: Wardrobe, t: TFunction, lang: Lang, stamp: Omit<StampInfo, 'sheet' | 'doc' | 'scale'>): string {
  const spec = computeSpec(computePanels(w));
  const sheets = computeCutting(spec);
  const o: string[] = [];
  const x0 = FRAME.x1 + 5;
  o.push(viewTitle(x0, 13, t('dr.cutting')));
  const cells = [
    { x: x0, y: 18 },
    { x: x0 + 197, y: 18 },
    { x: x0, y: 124 },
    { x: x0 + 197, y: 124 },
  ];
  sheets.slice(0, 4).forEach((cs, i) => {
    o.push(cutSheetSvg(cs, cells[i].x, cells[i].y, 185, 104, t, lang));
  });
  if (sheets.length > 4) o.push(text(x0, 236, t('dr.cuttingMore', { n: sheets.length - 4 }), { size: 3.5 }));
  o.push(frame(t, { ...stamp, doc: t('dr.stamp.docCut'), scale: '—', sheet: 3 }));
  return svgDoc(o.join(''));
}

/* ------------------------------------------------------------------ */

export function sheetScale(w: Wardrobe): number {
  return layoutSheet1(w).s;
}

/** Три листа чертежа: виды с размерами, спецификация с фурнитурой, раскрой. */
export function buildSheets(w: Wardrobe, t: TFunction, lang: Lang): string[] {
  let date: string;
  try {
    date = new Date(w.updatedAt || Date.now()).toLocaleDateString(LOCALE[lang]);
  } catch {
    date = new Date(w.updatedAt || Date.now()).toISOString().slice(0, 10);
  }
  const stamp = { project: w.name, date, dims: `${w.width}×${w.height}×${w.depth}` };
  return [sheet1(w, t, lang, stamp), sheet2(w, t, lang, stamp), sheet3(w, t, lang, stamp)];
}
