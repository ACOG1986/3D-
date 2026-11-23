import type { HardwareRow } from '../lib/geometry';
import type { MessageParams, PartName, ValidationIssue } from '../types/wardrobe';
import { en } from './en';
import { lt } from './lt';
import { ru, type MessageKey } from './ru';

export type Lang = 'ru' | 'lt' | 'en';
export type { MessageKey };
export const LANGS: Lang[] = ['ru', 'lt', 'en'];

const DICTS: Record<Lang, Record<MessageKey, string>> = { ru, lt, en };

export type TFunction = (key: MessageKey, params?: MessageParams) => string;

export function translate(lang: Lang, key: MessageKey, params?: MessageParams): string {
  const text = DICTS[lang][key] ?? ru[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
}

export function makeT(lang: Lang): TFunction {
  return (key, params) => translate(lang, key, params);
}

export function isMessageKey(k: string): k is MessageKey {
  return k in ru;
}

/** Ключ с проверкой: `tk('item.' + kind)` без потери типизации. */
export function tk(t: TFunction, key: string, params?: MessageParams): string {
  return isMessageKey(key) ? t(key, params) : key;
}

export function partName(t: TFunction, name: PartName): string {
  return t(`part.${name}` as MessageKey);
}

export function formatIssue(t: TFunction, issue: ValidationIssue): string {
  const p: MessageParams = { ...issue.params };
  if (typeof p.kind === 'string') p.kind = tk(t, `item.${p.kind}`).toLowerCase();
  if (typeof p.other === 'string') p.other = tk(t, `item.${p.other}`);
  if (typeof p.dim === 'string') p.dim = tk(t, `dim.${p.dim}`);
  return tk(t, `v.${issue.code}`, p);
}

export function hardwareName(t: TFunction, row: HardwareRow): string {
  const p: MessageParams = { ...row.params };
  if (typeof p.type === 'string') {
    const label = tk(t, `slide.${p.type}`);
    // В середине фразы — со строчной буквы («Направляющие шариковые»)
    const atStart = tk(t, `hw.${row.key}`).startsWith('{type}');
    p.type = atStart ? label : label.charAt(0).toLowerCase() + label.slice(1);
  }
  return tk(t, `hw.${row.key}`, p);
}

export function edgeLetters(t: TFunction): { L: string; W: string } {
  const s = t('spec.edgeLetters');
  return { L: s[0] ?? 'L', W: s[1] ?? 'W' };
}

export function decimalSep(lang: Lang): string {
  return lang === 'en' ? '.' : ',';
}

export function formatNumber(lang: Lang, n: number, digits = 2): string {
  const v = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(v).replace('.', decimalSep(lang));
}

export const LOCALE: Record<Lang, string> = { ru: 'ru-RU', lt: 'lt-LT', en: 'en-GB' };
