import { activeWardrobe, carcassDims, layoutSections } from '../../lib/geometry';
import { useWardrobe } from '../../store/wardrobeStore';
import type { DragKind } from '../panels/dragKinds';

/**
 * Добавляет элемент каталога в секцию под точкой сброса.
 * xMm — от левого края шкафа, yMm — от пола.
 */
export function dropOnModel(kind: DragKind, xMm: number, yMm: number) {
  const st = useWardrobe.getState();
  // В 2D-виде спереди добавляем в редактируемое крыло, в 3D — в основное
  const w = st.view === 'front' ? activeWardrobe(st.wardrobe, st.wing) : st.wardrobe;
  const d = carcassDims(w);
  const layout = layoutSections(w);
  const sec =
    layout.find((s) => xMm >= s.x - d.t && xMm <= s.x + s.width + d.t) ?? (xMm < w.width / 2 ? layout[0] : layout[layout.length - 1]);
  if (!sec) return;
  if (kind === 'section') {
    st.splitSection(sec.id);
    return;
  }
  st.addItem(sec.id, kind, yMm - d.innerBottom);
}
