import { describe, expect, it } from 'vitest';
import type { Wardrobe } from '../types/wardrobe';
import {
  addSection,
  carcassDims,
  clampItemY,
  computeCutting,
  computeDoors,
  computeHardware,
  computePanels,
  computeSpec,
  createItem,
  createWardrobe,
  findFreeY,
  fitSectionWidths,
  formatEdges,
  hingeCount,
  layoutSections,
  moveDivider,
  normalizeWardrobe,
  removeSection,
  snap,
  splitSection,
  validate,
} from './geometry';

function simple(overrides: Partial<Wardrobe> = {}): Wardrobe {
  const w = createWardrobe('swing');
  return normalizeWardrobe({
    ...w,
    width: 1000,
    height: 2000,
    depth: 600,
    boardThickness: 16,
    backThickness: 4,
    plinth: { enabled: true, height: 80 },
    sections: [{ id: 's1', width: 968, items: [] }],
    doors: { ...w.doors, kind: 'swing', count: 2, gap: 3, overrides: [] },
    ...overrides,
  });
}

describe('snap', () => {
  it('привязывает к шагу 10 мм', () => {
    expect(snap(1234)).toBe(1230);
    expect(snap(1235)).toBe(1240);
    expect(snap(7, 5)).toBe(5);
  });
});

describe('carcassDims', () => {
  it('считает внутренние размеры с цоколем', () => {
    const d = carcassDims(simple());
    expect(d.innerWidth).toBe(1000 - 32);
    expect(d.innerHeight).toBe(2000 - 80 - 32);
    expect(d.innerBottom).toBe(96);
    // накладные двери: глубина корпуса = 600 − 16 − 2
    expect(d.carcassDepth).toBe(582);
    expect(d.panelDepth).toBe(578);
  });

  it('для купе оставляет зону под двери', () => {
    const w = simple({ doors: { ...simple().doors, kind: 'sliding', count: 2 } });
    const d = carcassDims(w);
    expect(d.carcassDepth).toBe(600);
    expect(d.interiorDepth).toBe(600 - 4 - 100);
  });
});

describe('секции', () => {
  it('fitSectionWidths сохраняет сумму', () => {
    const out = fitSectionWidths([300, 300, 300], 1000);
    expect(out.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('layoutSections учитывает перегородки', () => {
    const w = addSection(simple());
    const l = layoutSections(w);
    expect(l).toHaveLength(2);
    expect(l[0].x).toBe(16);
    expect(l[1].x).toBe(16 + l[0].width + 16);
    expect(l[0].width + l[1].width + 16).toBe(968);
  });

  it('splitSection и removeSection обратимы по ширине', () => {
    const w = simple();
    const split = normalizeWardrobe(splitSection(w, 's1'));
    expect(split.sections).toHaveLength(2);
    const back = removeSection(split, split.sections[1].id);
    expect(back.sections).toHaveLength(1);
    expect(back.sections[0].width).toBe(968);
  });

  it('moveDivider не делает секцию уже минимума', () => {
    const w = addSection(simple());
    const moved = moveDivider(w, 0, 10);
    expect(moved.sections[0].width).toBe(150);
    expect(moved.sections[0].width + moved.sections[1].width).toBe(w.sections[0].width + w.sections[1].width);
  });
});

describe('наполнение', () => {
  it('clampItemY ограничивает полку внутренней высотой', () => {
    const w = simple();
    const shelf = createItem('shelf', 0);
    const inner = carcassDims(w).innerHeight;
    expect(clampItemY(w, shelf, 99999)).toBeLessThanOrEqual(inner - 16);
    expect(clampItemY(w, shelf, -50)).toBe(0);
  });

  it('findFreeY обходит занятые места', () => {
    const w = simple();
    const section = { ...w.sections[0], items: [createItem('drawer', 0)] };
    const y = findFreeY(w, section, createItem('drawer', 0), 0);
    expect(y).toBeGreaterThanOrEqual(180);
  });

  it('съёмная полка короче секции на 2 мм и с отступом от фасада', () => {
    const w = simple();
    w.sections[0].items = [createItem('shelf', 500)];
    const shelf = computePanels(w).find((p) => p.name === 'shelfRemovable');
    expect(shelf).toBeDefined();
    expect(shelf!.length).toBe(966);
    expect(shelf!.widthMm).toBe(578 - 10);
    expect(shelf!.thickness).toBe(16);
  });
});

describe('двери', () => {
  it('распашные: ширина с учётом зазоров', () => {
    const doors = computeDoors(simple());
    expect(doors).toHaveLength(2);
    expect(doors[0].width).toBe(Math.floor((1000 - 2 * 3) / 2));
    expect(doors[0].height).toBe(2000 - 80 - 3);
    expect(doors[0].hingeSide).toBe('left');
    expect(doors[1].hingeSide).toBe('right');
  });

  it('купе: перекрытие 30 мм и не выходит за проём', () => {
    const w = simple({ width: 2000, doors: { ...simple().doors, kind: 'sliding', count: 3 } });
    const doors = computeDoors(w);
    const opening = 2000 - 32;
    expect(doors).toHaveLength(3);
    expect(doors[0].width).toBe(Math.round((opening + 60) / 3));
    const last = doors[2];
    expect(last.x + last.width).toBeLessThanOrEqual(16 + opening);
    expect(doors[1].track).toBe(1);
  });

  it('количество петель по высоте', () => {
    expect(hingeCount(700)).toBe(2);
    expect(hingeCount(1500)).toBe(3);
    expect(hingeCount(1917)).toBe(4);
    expect(hingeCount(2300)).toBe(5);
    expect(hingeCount(2600)).toBe(6);
  });
});

describe('спецификация', () => {
  it('группирует одинаковые детали', () => {
    const w = simple();
    w.sections[0].items = [createItem('shelf', 400), createItem('shelf', 800), createItem('shelf', 1200)];
    const spec = computeSpec(computePanels(w));
    const sides = spec.find((r) => r.name === 'side');
    expect(sides?.qty).toBe(2);
    expect(sides?.length).toBe(2000);
    expect(sides?.width).toBe(578);
    const shelves = spec.find((r) => r.name === 'shelfRemovable');
    expect(shelves?.qty).toBe(3);
    const doors = spec.find((r) => r.name === 'doorSwing');
    expect(doors?.qty).toBe(2);
    // позиции пронумерованы по порядку
    expect(spec.map((r) => r.pos)).toEqual(spec.map((_, i) => i + 1));
  });

  it('кромка лицевого торца боковины — по длине', () => {
    const side = computePanels(simple()).find((p) => p.name === 'side')!;
    expect(side.edges.L1).toBe(2);
    expect(formatEdges(side.edges)).toBe('2: Д1 · 0,4: Ш1 Ш2');
    expect(formatEdges(side.edges, { L: 'L', W: 'W' }, '.')).toBe('2: L1 · 0.4: W1 W2');
  });

  it('ящик даёт фасад, 2 боковины, 2 стенки и дно', () => {
    const w = simple();
    w.sections[0].items = [createItem('drawer', 0)];
    const spec = computeSpec(computePanels(w));
    expect(spec.find((r) => r.name === 'drawerSide')?.qty).toBe(2);
    expect(spec.find((r) => r.name === 'drawerFrontBack')?.qty).toBe(2);
    expect(spec.find((r) => r.name === 'drawerBottom')?.qty).toBe(1);
    expect(spec.find((r) => r.name === 'drawerFront')?.qty).toBe(1);
  });

  it('штанга не попадает в спецификацию деталей, но есть в фурнитуре', () => {
    const w = simple();
    w.sections[0].items = [createItem('rod', 1500)];
    const spec = computeSpec(computePanels(w));
    expect(spec.some((r) => r.name === 'rod')).toBe(false);
    const hw = computeHardware(w);
    expect(hw.find((h) => h.key === 'rodTube')?.qty).toBe(0.97);
    expect(hw.find((h) => h.key === 'rodHolder')?.qty).toBe(2);
  });

  it('петли считаются по каждой двери', () => {
    const hw = computeHardware(simple());
    expect(hw.find((h) => h.key === 'hingeOverlay')?.qty).toBe(2 * hingeCount(1917));
  });
});

describe('валидация', () => {
  it('предупреждает о полке длиннее 900 мм', () => {
    const w = simple();
    w.sections[0].items = [createItem('shelf', 500)];
    const issues = validate(w);
    expect(issues.some((i) => i.code === 'shelfSag' && i.severity === 'warning')).toBe(true);
  });

  it('ошибка при пересечении элементов', () => {
    const w = simple();
    w.sections[0].items = [createItem('drawer', 0), createItem('shelf', 100)];
    expect(validate(w).some((i) => i.code === 'itemOverlap')).toBe(true);
  });

  it('ошибка при выходе габаритов за пределы', () => {
    const w = simple({ width: 5000 });
    expect(validate(w).some((i) => i.code === 'range' && i.params.dim === 'width')).toBe(true);
  });

  it('шаблон по умолчанию без ошибок', () => {
    for (const type of ['swing', 'sliding', 'combined', 'built-in'] as const) {
      const errors = validate(createWardrobe(type)).filter((i) => i.severity === 'error');
      expect(errors).toEqual([]);
    }
  });
});

describe('раскрой', () => {
  it('все плитные детали размещены и не пересекаются', () => {
    const w = createWardrobe('swing');
    const spec = computeSpec(computePanels(w));
    const sheets = computeCutting(spec);
    const placed = sheets.reduce((a, s) => a + s.placements.length, 0);
    const expected = spec.filter((r) => r.thickness >= 8 && !r.material.startsWith('glass') && !r.material.startsWith('mirror')).reduce((a, r) => a + r.qty, 0);
    expect(placed).toBe(expected);
    for (const s of sheets) {
      for (const [i, a] of s.placements.entries()) {
        expect(a.x + a.w).toBeLessThanOrEqual(s.length);
        expect(a.y + a.h).toBeLessThanOrEqual(s.width);
        for (const b of s.placements.slice(i + 1)) {
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
      }
    }
  });
});
