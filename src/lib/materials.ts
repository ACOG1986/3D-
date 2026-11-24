import type { MaterialId } from '../types/wardrobe';

export type MaterialKind = 'ldsp' | 'mdf' | 'veneer' | 'glass' | 'mirror' | 'hdf';

export type LocalizedName = { ru: string; lt: string; en: string };

export interface Material {
  id: MaterialId;
  name: LocalizedName;
  kind: MaterialKind;
  color: string;
  /** Есть ли направление текстуры (рисунок древесины). */
  grain: boolean;
  roughness: number;
  metalness: number;
  /** Прозрачность для стекла (0..1). */
  opacity?: number;
  /** Можно ли использовать для корпуса. */
  body: boolean;
  /** Можно ли использовать для фасада. */
  facade: boolean;
}

export const MATERIALS: Material[] = [
  {
    id: 'ldsp-white',
    name: { ru: 'ЛДСП Белый гладкий', lt: 'Laminuota MDP balta', en: 'White melamine board' },
    kind: 'ldsp',
    color: '#f3f2ee',
    grain: false,
    roughness: 0.55,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'ldsp-grey',
    name: { ru: 'ЛДСП Серый камень', lt: 'Laminuota MDP pilkas akmuo', en: 'Grey stone melamine' },
    kind: 'ldsp',
    color: '#9ea2a3',
    grain: false,
    roughness: 0.6,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'ldsp-graphite',
    name: { ru: 'ЛДСП Графит', lt: 'Laminuota MDP grafitas', en: 'Graphite melamine' },
    kind: 'ldsp',
    color: '#3f4246',
    grain: false,
    roughness: 0.55,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'ldsp-oak-sonoma',
    name: { ru: 'ЛДСП Дуб Сонома', lt: 'Laminuota MDP Sonoma ąžuolas', en: 'Sonoma oak melamine' },
    kind: 'ldsp',
    color: '#d2b48a',
    grain: true,
    roughness: 0.65,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'ldsp-oak-craft',
    name: { ru: 'ЛДСП Дуб Крафт', lt: 'Laminuota MDP Craft ąžuolas', en: 'Craft oak melamine' },
    kind: 'ldsp',
    color: '#b88a55',
    grain: true,
    roughness: 0.65,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'ldsp-walnut',
    name: { ru: 'ЛДСП Орех', lt: 'Laminuota MDP riešutas', en: 'Walnut melamine' },
    kind: 'ldsp',
    color: '#6e4b33',
    grain: true,
    roughness: 0.6,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'ldsp-wenge',
    name: { ru: 'ЛДСП Венге', lt: 'Laminuota MDP wenge', en: 'Wenge melamine' },
    kind: 'ldsp',
    color: '#3b2a22',
    grain: true,
    roughness: 0.6,
    metalness: 0,
    body: true,
    facade: true,
  },
  {
    id: 'mdf-white-matt',
    name: { ru: 'МДФ эмаль белая матовая', lt: 'MDF dažytas baltas matinis', en: 'MDF painted white matt' },
    kind: 'mdf',
    color: '#fafafa',
    grain: false,
    roughness: 0.4,
    metalness: 0,
    body: false,
    facade: true,
  },
  {
    id: 'mdf-sage',
    name: { ru: 'МДФ эмаль шалфей', lt: 'MDF dažytas šalavijo', en: 'MDF painted sage' },
    kind: 'mdf',
    color: '#a7b4a0',
    grain: false,
    roughness: 0.4,
    metalness: 0,
    body: false,
    facade: true,
  },
  {
    id: 'mdf-navy',
    name: { ru: 'МДФ эмаль тёмно-синяя', lt: 'MDF dažytas tamsiai mėlynas', en: 'MDF painted navy' },
    kind: 'mdf',
    color: '#24324a',
    grain: false,
    roughness: 0.35,
    metalness: 0,
    body: false,
    facade: true,
  },
  {
    id: 'veneer-oak',
    name: { ru: 'Шпон дуба натуральный', lt: 'Natūralus ąžuolo lukštas', en: 'Natural oak veneer' },
    kind: 'veneer',
    color: '#c79f6d',
    grain: true,
    roughness: 0.5,
    metalness: 0,
    body: false,
    facade: true,
  },
  {
    id: 'veneer-ash',
    name: { ru: 'Шпон ясеня', lt: 'Uosio lukštas', en: 'Ash veneer' },
    kind: 'veneer',
    color: '#dcc6a4',
    grain: true,
    roughness: 0.5,
    metalness: 0,
    body: false,
    facade: true,
  },
  {
    id: 'glass-frosted',
    name: { ru: 'Стекло сатинат', lt: 'Matinis stiklas', en: 'Frosted glass' },
    kind: 'glass',
    color: '#dfe9ec',
    grain: false,
    roughness: 0.25,
    metalness: 0,
    opacity: 0.55,
    body: false,
    facade: true,
  },
  {
    id: 'glass-bronze',
    name: { ru: 'Стекло бронза', lt: 'Bronzinis stiklas', en: 'Bronze glass' },
    kind: 'glass',
    color: '#8a6a4a',
    grain: false,
    roughness: 0.1,
    metalness: 0.1,
    opacity: 0.45,
    body: false,
    facade: true,
  },
  {
    id: 'mirror-silver',
    name: { ru: 'Зеркало серебро', lt: 'Sidabrinis veidrodis', en: 'Silver mirror' },
    kind: 'mirror',
    color: '#e8eef2',
    grain: false,
    roughness: 0.03,
    metalness: 1,
    body: false,
    facade: true,
  },
  {
    id: 'hdf-white',
    name: { ru: 'ХДФ белый', lt: 'HDF baltas', en: 'White HDF' },
    kind: 'hdf',
    color: '#f1f0ec',
    grain: false,
    roughness: 0.7,
    metalness: 0,
    body: false,
    facade: false,
  },
];

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

export const FALLBACK_MATERIAL: Material = MATERIALS[0];

export function getMaterial(id: MaterialId): Material {
  return BY_ID.get(id) ?? FALLBACK_MATERIAL;
}

export function materialName(id: MaterialId, lang: keyof LocalizedName = 'ru'): string {
  return getMaterial(id).name[lang];
}

/** Стекло и зеркало — не плитные материалы: не идут в раскрой ЛДСП и без кромки. */
export function isSheetGoods(id: MaterialId): boolean {
  const k = getMaterial(id).kind;
  return k !== 'glass' && k !== 'mirror';
}

export function bodyMaterials(): Material[] {
  return MATERIALS.filter((m) => m.body);
}

export function facadeMaterials(): Material[] {
  return MATERIALS.filter((m) => m.facade);
}

export function backMaterials(): Material[] {
  return MATERIALS.filter((m) => m.kind === 'hdf');
}
