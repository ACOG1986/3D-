import { useId } from 'react';

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
}

export interface SelectProps<V extends string | number> {
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (v: V) => void;
  disabled?: boolean;
}

export function Select<V extends string | number>({ label, value, options, onChange, disabled }: SelectProps<V>) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <select
        id={id}
        className="input"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface SegmentedProps<V extends string | number> {
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (v: V) => void;
}

/** Переключатель-сегменты для 2–4 вариантов. */
export function Segmented<V extends string | number>({ label, value, options, onChange }: SegmentedProps<V>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
