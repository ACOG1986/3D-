import { describe, expect, it } from 'vitest';
import { computeDoors, layoutSections, validate } from '../../lib/geometry';
import type { WardrobeType } from '../../types/wardrobe';
import { buildWardrobe, defaultAnswers, SIZE_PRESETS, type FillPreset } from './buildWardrobe';

const TYPES: WardrobeType[] = ['swing', 'sliding', 'combined', 'built-in', 'corner'];
const FILLS: FillPreset[] = ['hang', 'shelves', 'balanced'];

describe('мастер: сборка шкафа', () => {
  it('применяет размеры и материалы', () => {
    const w = buildWardrobe({ ...defaultAnswers('Тест'), width: 2000, height: 2500, depth: 580, body: 'ldsp-grey', facade: 'mdf-sage' });
    expect([w.width, w.height, w.depth]).toEqual([2000, 2500, 580]);
    expect(w.bodyMaterial).toBe('ldsp-grey');
    expect(w.doors.material).toBe('mdf-sage');
    expect(w.name).toBe('Тест');
  });

  it('секции не шире 800 мм, двери не шире 600 мм', () => {
    const w = buildWardrobe({ ...defaultAnswers('x'), width: 2400 });
    for (const s of layoutSections(w)) expect(s.width).toBeLessThanOrEqual(800);
    for (const d of computeDoors(w)) expect(d.width).toBeLessThanOrEqual(600);
  });

  it('все пресеты и типы собираются без ошибок проверки', () => {
    for (const type of TYPES)
      for (const fill of FILLS)
        for (const p of SIZE_PRESETS) {
          if (type === 'corner' && p.width < p.depth + 300) continue;
          const w = buildWardrobe({ ...defaultAnswers('x'), type, fill, width: p.width, height: p.height, depth: p.depth });
          const errors = validate(w).filter((i) => i.severity === 'error');
          expect({ type, fill, size: p.key, errors }).toEqual({ type, fill, size: p.key, errors: [] });
        }
  });

  it('«Больше вешать» добавляет штанги, «Больше полок» — только полки', () => {
    const hang = buildWardrobe({ ...defaultAnswers('x'), fill: 'hang' });
    const shelves = buildWardrobe({ ...defaultAnswers('x'), fill: 'shelves' });
    const kinds = (w: typeof hang) => w.sections.flatMap((s) => s.items.map((i) => i.kind));
    expect(kinds(hang).filter((k) => k === 'rod').length).toBeGreaterThanOrEqual(2);
    expect(kinds(shelves).every((k) => k === 'shelf')).toBe(true);
  });

  it('угловой шкаф получает боковое крыло заданной ширины', () => {
    const w = buildWardrobe({ ...defaultAnswers('x'), type: 'corner', width: 2000, wingWidth: 1500 });
    expect(w.corner?.width).toBe(1500);
  });
});
