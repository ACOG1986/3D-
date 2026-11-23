import { getMaterial, type Material } from '../../lib/materials';
import { useWardrobe } from '../../store/wardrobeStore';

export interface MaterialPickerProps {
  label: string;
  value: string;
  materials: Material[];
  onChange: (id: string) => void;
  /** Показать вариант «не задано» (для переопределения декора двери). */
  allowNone?: { label: string; selected: boolean; onSelect: () => void };
}

function swatchStyle(m: Material): React.CSSProperties {
  if (m.kind === 'mirror') return { background: 'linear-gradient(135deg,#f8fafc,#94a3b8 50%,#e2e8f0)' };
  if (m.kind === 'glass') return { background: m.color, opacity: 0.75 };
  if (m.grain)
    return {
      background: `repeating-linear-gradient(90deg, ${m.color} 0 3px, color-mix(in srgb, ${m.color} 85%, black) 3px 4px)`,
    };
  return { background: m.color };
}

/** Палитра декоров с образцами цвета; доступна с клавиатуры (radiogroup). */
export function MaterialPicker({ label, value, materials, onChange, allowNone }: MaterialPickerProps) {
  const lang = useWardrobe((s) => s.lang);
  const current = getMaterial(value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {label}: <span className="font-medium text-slate-700 dark:text-slate-200">{allowNone?.selected ? allowNone.label : current.name[lang]}</span>
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            role="radio"
            aria-checked={allowNone.selected}
            title={allowNone.label}
            aria-label={allowNone.label}
            onClick={allowNone.onSelect}
            className={`h-7 w-7 rounded-md border text-xs text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              allowNone.selected ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            ∅
          </button>
        )}
        {materials.map((m) => {
          const on = !allowNone?.selected && m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={m.name[lang]}
              aria-label={m.name[lang]}
              onClick={() => onChange(m.id)}
              style={swatchStyle(m)}
              className={`h-7 w-7 rounded-md border border-black/10 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                on ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900' : ''
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
