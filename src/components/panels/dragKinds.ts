import type { SectionItemKind } from '../../types/wardrobe';

export type DragKind = SectionItemKind | 'fixedShelf' | 'section';
export const DRAG_MIME = 'application/x-wardrobe-item';
const KINDS: DragKind[] = ['section', 'shelf', 'fixedShelf', 'drawer', 'rod', 'basket', 'pantograph'];

export function readDragKind(dt: DataTransfer): DragKind | null {
  const v = dt.getData(DRAG_MIME) || dt.getData('text/plain');
  return (KINDS as string[]).includes(v) ? (v as DragKind) : null;
}

export const CATALOG: DragKind[] = KINDS;
