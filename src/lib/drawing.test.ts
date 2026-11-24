import { describe, expect, it } from 'vitest';
import { makeT, type Lang } from '../i18n';
import { buildSheets, esc, sheetCount, sheetScale } from './drawing';
import { createWardrobe } from './geometry';

describe('buildSheets', () => {
  const w = createWardrobe('swing', 'Тест <&>');

  it('возвращает 3 листа A3 в SVG', () => {
    const sheets = buildSheets(w, makeT('ru'), 'ru');
    expect(sheets).toHaveLength(3);
    for (const s of sheets) {
      expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(s).toContain('viewBox="0 0 420 297"');
      expect(s.endsWith('</svg>')).toBe(true);
      expect(s).not.toContain('NaN');
      expect(s).not.toContain('undefined');
    }
  });

  it('содержит габаритные размеры и экранирует текст', () => {
    const [s1] = buildSheets(w, makeT('ru'), 'ru');
    expect(s1).toContain(`>${w.width}<`);
    expect(s1).toContain(`>${w.height}<`);
    expect(s1).toContain('Тест &lt;&amp;&gt;');
    expect(esc('a"b')).toBe('a&quot;b');
  });

  it.each<[Lang, string]>([
    ['ru', 'Вид спереди'],
    ['lt', 'Vaizdas iš priekio'],
    ['en', 'Front view'],
  ])('заголовки на языке %s', (lang, title) => {
    const sheets = buildSheets(w, makeT(lang), lang);
    expect(sheets[0]).toContain(title);
  });

  it('выбирает стандартный масштаб', () => {
    expect([10, 15, 20]).toContain(sheetScale(w));
    expect(sheetScale({ ...w, width: 4000, height: 2800 })).toBeGreaterThanOrEqual(25);
  });

  it('купе и комбинированный строятся без ошибок', () => {
    for (const type of ['sliding', 'combined', 'built-in'] as const) {
      const sheets = buildSheets(createWardrobe(type), makeT('en'), 'en');
      expect(sheets[1]).toContain('Cutting list');
      expect(sheets.join('')).not.toContain('NaN');
    }
  });

  it('угловой шкаф: 4 листа, лист бокового крыла и план', () => {
    const c = createWardrobe('corner', 'Угол');
    expect(c.corner).toBeDefined();
    expect(sheetCount(c)).toBe(4);
    const sheets = buildSheets(c, makeT('ru'), 'ru');
    expect(sheets).toHaveLength(4);
    expect(sheets[0]).toContain('План (вид сверху)');
    expect(sheets[0]).toContain(`>${c.corner!.width}<`);
    expect(sheets[1]).toContain('Боковое крыло: вид спереди');
    expect(sheets[1]).toContain(`>${c.corner!.width}<`);
    // нумерация листов: «4» как общее количество в основной надписи
    for (const s of sheets) expect(s).toMatch(/>4<\/text>/);
    expect(sheets.join('')).not.toContain('NaN');
  });

  it('ХДФ попадает в схему раскроя на своём листе 2800×2070', () => {
    const sheets = buildSheets(w, makeT('ru'), 'ru');
    const cut = sheets[sheets.length - 1];
    expect(cut).toContain('ХДФ');
    expect(cut).toContain('2800×2070');
    expect(sheetCount(w)).toBe(3);
  });
});
