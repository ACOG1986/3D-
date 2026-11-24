/* Пересчёт координат между экраном, SVG и HTML-контейнером. */

/** Точка экрана → координаты SVG (с учётом viewBox и масштабирования). */
export function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const r = pt.matrixTransform(ctm.inverse());
  return { x: r.x, y: r.y };
}

/** Координаты SVG → пиксели относительно контейнера (для HTML-оверлеев). */
export function svgToContainer(svg: SVGSVGElement, container: HTMLElement, x: number, y: number): { left: number; top: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const r = pt.matrixTransform(ctm);
  const c = container.getBoundingClientRect();
  return { left: r.x - c.left, top: r.y - c.top };
}
