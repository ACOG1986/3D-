/**
 * Экспорт чертежа: PDF (все листы), SVG и PNG (по листу), JSON-конфигурация.
 * jsPDF и svg2pdf.js подгружаются лениво — только при экспорте в PDF.
 */
import type { Lang, TFunction } from '../i18n';
import type { Wardrobe } from '../types/wardrobe';
import { buildSheets, SHEET_H, SHEET_W } from './drawing';
import { exportProjectJson } from './projects';

const FONT_FAMILY = 'PT Sans Narrow';
const FONT_FILES = { normal: 'PTSansNarrow-Regular.ttf', bold: 'PTSansNarrow-Bold.ttf' } as const;

export function safeFileName(name: string): string {
  // Только буквы (включая кириллицу и литовские), цифры, «-» и «_»: иначе браузер отбрасывает имя
  const s = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return s || 'wardrobe';
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

const fontCache = new Map<string, Promise<string>>();

/** Шрифт с кириллицей и литовскими символами (PT Sans Narrow, OFL) в base64. */
function loadFont(file: string): Promise<string> {
  let p = fontCache.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`font ${file}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(arrayBufferToBase64);
    p.catch(() => fontCache.delete(file));
    fontCache.set(file, p);
  }
  return p;
}

function parseSvg(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const el = doc.documentElement;
  if (el.nodeName !== 'svg') throw new Error('invalid SVG');
  return el as unknown as SVGSVGElement;
}

export async function exportPdf(w: Wardrobe, t: TFunction, lang: Lang): Promise<void> {
  const [{ jsPDF }, , regular, bold] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    loadFont(FONT_FILES.normal),
    loadFont(FONT_FILES.bold),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  doc.addFileToVFS(FONT_FILES.normal, regular);
  doc.addFont(FONT_FILES.normal, FONT_FAMILY, 'normal');
  doc.addFileToVFS(FONT_FILES.bold, bold);
  doc.addFont(FONT_FILES.bold, FONT_FAMILY, 'bold');
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setProperties({ title: w.name, subject: `${w.width}×${w.height}×${w.depth}`, creator: t('app.title') });

  const sheets = buildSheets(w, t, lang);
  // svg2pdf надёжнее работает с элементом, вставленным в документ
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden';
  document.body.appendChild(host);
  try {
    for (let i = 0; i < sheets.length; i++) {
      if (i > 0) doc.addPage('a3', 'landscape');
      const el = parseSvg(sheets[i]);
      const node = document.importNode(el, true);
      host.appendChild(node);
      await doc.svg(node, { x: 0, y: 0, width: SHEET_W, height: SHEET_H });
      host.removeChild(node);
    }
  } finally {
    host.remove();
  }
  downloadBlob(doc.output('blob'), `${safeFileName(w.name)}.pdf`);
}

export function exportSvg(w: Wardrobe, t: TFunction, lang: Lang, index: number): void {
  const svg = buildSheets(w, t, lang)[index];
  if (!svg) return;
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n`, svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${safeFileName(w.name)}_${index + 1}.svg`);
}

/** Встраивает шрифт в SVG через @font-face (нужно для растеризации в PNG). */
async function withEmbeddedFont(svg: string): Promise<string> {
  const [regular, bold] = await Promise.all([loadFont(FONT_FILES.normal), loadFont(FONT_FILES.bold)]);
  const style =
    `<defs><style>@font-face{font-family:'${FONT_FAMILY}';font-weight:normal;src:url(data:font/ttf;base64,${regular}) format('truetype');}` +
    `@font-face{font-family:'${FONT_FAMILY}';font-weight:bold;src:url(data:font/ttf;base64,${bold}) format('truetype');}</style></defs>`;
  return svg.replace(/(<svg[^>]*>)/, `$1${style}`);
}

export async function renderSheetPng(svg: string, dpi = 200): Promise<Blob> {
  const withFont = await withEmbeddedFont(svg);
  const px = (mm: number) => Math.round((mm / 25.4) * dpi);
  const width = px(SHEET_W);
  const height = px(SHEET_H);
  const sized = withFont.replace(/width="420mm" height="297mm"/, `width="${width}" height="${height}"`);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG render failed'));
    img.src = url;
  });
  if ('fonts' in document) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export async function exportPng(w: Wardrobe, t: TFunction, lang: Lang, index: number): Promise<void> {
  const svg = buildSheets(w, t, lang)[index];
  if (!svg) return;
  const blob = await renderSheetPng(svg);
  downloadBlob(blob, `${safeFileName(w.name)}_${index + 1}.png`);
}

export function exportJson(w: Wardrobe): void {
  const blob = new Blob([exportProjectJson(w)], { type: 'application/json' });
  downloadBlob(blob, `${safeFileName(w.name)}.json`);
}
