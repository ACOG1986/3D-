/**
 * Модель шкафа — единый источник истины.
 * Все размеры в миллиметрах. Система координат корпуса:
 *   x — слева направо (0 … width),
 *   y — от пола вверх (0 … height),
 *   z — от задней стенки к фасаду (0 … depth).
 */

export type MaterialId = string;

export type WardrobeType = 'swing' | 'sliding' | 'corner' | 'built-in' | 'combined';
export type BoardThickness = 16 | 18 | 22;
export type BackThickness = 3 | 4;
/** Толщина кромки ПВХ, 0 — без кромки. */
export type EdgeThickness = 0 | 0.4 | 2;

export type HingeType = 'overlay' | 'half-overlay' | 'inset';
export type SlideType = 'roller' | 'ball' | 'tandem';
export type HandleType = 'bar' | 'knob' | 'push';
export type DoorKind = 'swing' | 'sliding' | 'lift' | 'none';

export interface ShelfItem {
  id: string;
  kind: 'shelf';
  /** Отметка низа полки от верха дна секции (внутренняя высота), мм. */
  y: number;
  /** Неподвижная (на конфирматах), например антресольная полка. */
  fixed?: boolean;
}

export interface DrawerItem {
  id: string;
  kind: 'drawer';
  y: number;
  /** Высота фасада ящика, мм. */
  height: number;
  slide: SlideType;
}

export interface RodItem {
  id: string;
  kind: 'rod';
  /** Отметка оси штанги, мм. */
  y: number;
}

export interface BasketItem {
  id: string;
  kind: 'basket';
  y: number;
  height: number;
}

export interface PantographItem {
  id: string;
  kind: 'pantograph';
  /** Отметка крепления (оси) пантографа, мм. */
  y: number;
}

export type SectionItem = ShelfItem | DrawerItem | RodItem | BasketItem | PantographItem;
export type SectionItemKind = SectionItem['kind'];

export interface Section {
  id: string;
  /** Внутренняя ширина секции в свету, мм. */
  width: number;
  items: SectionItem[];
}

export interface DoorsConfig {
  kind: DoorKind;
  /** Количество дверей (для купе 2 или 3). */
  count: number;
  material: MaterialId;
  /** Индивидуальный декор отдельных дверей (по индексу), иначе material. */
  overrides: (MaterialId | null)[];
  /** Зазор между фасадами, мм. */
  gap: number;
  handle: HandleType;
}

export interface EdgeConfig {
  /** Кромка видимых (лицевых) торцов. */
  visible: EdgeThickness;
  /** Кромка скрытых торцов. */
  hidden: EdgeThickness;
}

export interface PlinthConfig {
  enabled: boolean;
  height: number;
}

export type Unit = 'pcs' | 'set' | 'm' | 'pair';

export interface HardwareItem {
  id: string;
  name: string;
  article?: string;
  qty: number;
  unit: Unit;
}

/**
 * Второе крыло Г-образного углового шкафа. Стоит вдоль боковой стены,
 * торцом примыкает к фасаду основного крыла. Высота, глубина, материалы
 * и тип фасадов — общие с основным крылом.
 */
export interface CornerConfig {
  /** С какой стороны основного крыла стоит боковое (если смотреть на основное). */
  side: 'left' | 'right';
  /** Габаритная ширина бокового крыла, мм. */
  width: number;
  /** Секции бокового крыла слева направо (если смотреть на него). */
  sections: Section[];
  /** Количество дверей бокового крыла. */
  doorCount: number;
}

export interface Wardrobe {
  id: string;
  name: string;
  type: WardrobeType;
  width: number;
  height: number;
  depth: number;
  boardThickness: BoardThickness;
  backThickness: BackThickness;
  bodyMaterial: MaterialId;
  backMaterial: MaterialId;
  edge: EdgeConfig;
  plinth: PlinthConfig;
  hinge: HingeType;
  defaultSlide: SlideType;
  doors: DoorsConfig;
  /** Секции слева направо. */
  sections: Section[];
  /** Дополнительная (ручная) фурнитура сверх рассчитанной. */
  hardware: HardwareItem[];
  /** Боковое крыло (только для type === 'corner'). */
  corner?: CornerConfig;
  createdAt: number;
  updatedAt: number;
}

/* ---------- Производные (рассчитанные) сущности ---------- */

export type PartGroup = 'body' | 'back' | 'facade' | 'drawer' | 'plinth';

/** Ссылка на элемент модели, к которому относится деталь (для выделения). */
export type EntityRef =
  | { type: 'carcass' }
  | { type: 'section'; sectionId: string }
  | { type: 'divider'; index: number; wing?: boolean }
  | { type: 'item'; sectionId: string; itemId: string }
  | { type: 'door'; index: number };

/** Кромка по четырём торцам детали: длинные (L1, L2) и короткие (W1, W2). */
export interface PartEdges {
  L1: EdgeThickness;
  L2: EdgeThickness;
  W1: EdgeThickness;
  W2: EdgeThickness;
}

export type PartName =
  | 'side'
  | 'top'
  | 'bottom'
  | 'plinthFront'
  | 'plinthBack'
  | 'back'
  | 'divider'
  | 'shelfFixed'
  | 'shelfRemovable'
  | 'drawerFront'
  | 'drawerSide'
  | 'drawerFrontBack'
  | 'drawerBottom'
  | 'rod'
  | 'basket'
  | 'pantograph'
  | 'doorSwing'
  | 'doorLift'
  | 'doorSliding';

/** Деталь в пространстве — прямоугольный брусок (для 3D и видов). */
export interface Panel {
  key: string;
  name: PartName;
  group: PartGroup;
  material: MaterialId;
  /** Минимальный угол бруска (x, y, z) и размеры по осям, мм. */
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Размеры детали для спецификации: длина ≥ ширина, толщина. */
  length: number;
  widthMm: number;
  thickness: number;
  edges: PartEdges;
  ref: EntityRef;
  /** Не плитная деталь (штанга, корзина) — только для 3D/видов. */
  nonBoard?: boolean;
  /** Ось длинной стороны штанги/пантографа в мировых координатах (по умолчанию x). */
  axis?: 'x' | 'z';
  /** Деталь бокового крыла углового шкафа. */
  wing?: boolean;
}

export interface SpecRow {
  pos: number;
  name: PartName;
  qty: number;
  length: number;
  width: number;
  thickness: number;
  material: MaterialId;
  edges: PartEdges;
  group: PartGroup;
  /** Размер распила: чистовой размер минус толщина кромки на соответствующих торцах. */
  cutLength: number;
  cutWidth: number;
}

/** Режим спецификации: «для заказа» — чистовые размеры, «для распила» — за вычетом кромки. */
export type SpecMode = 'order' | 'cut';

export interface Door {
  index: number;
  kind: Exclude<DoorKind, 'none'>;
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
  material: MaterialId;
  /** Для распашной: сторона петель. */
  hingeSide?: 'left' | 'right';
  /** Для купе: номер направляющей (0 — задняя). */
  track?: number;
}

export type Severity = 'error' | 'warning';

/** Параметры сообщения подставляются в перевод по коду. */
export type MessageParams = Record<string, string | number>;

export interface ValidationIssue {
  severity: Severity;
  code: string;
  params: MessageParams;
  ref?: EntityRef;
}

export interface SectionLayout {
  id: string;
  index: number;
  /** Левая внутренняя граница секции, мм. */
  x: number;
  width: number;
}
