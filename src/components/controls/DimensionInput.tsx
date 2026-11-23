import { HelpTip } from '../onboarding/HelpTip';
import { useEffect, useId, useRef, useState } from 'react';

export interface DimensionInputProps {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Скрыть подпись визуально (остаётся aria-label). */
  hideLabel?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  disabled?: boolean;
  /** Пояснение простыми словами (значок «i»). */
  help?: string;
}

/**
 * Поле ввода размера в мм. Значение применяется по Enter/blur,
 * Esc — отмена, стрелки — шаг (Shift — ×10). Выход за пределы подсвечивается.
 */
export function DimensionInput({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  unit = 'мм',
  hideLabel,
  compact,
  autoFocus,
  onCancel,
  disabled,
  help,
}: DimensionInputProps) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setText(String(value)), [value]);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);

  const parsed = Number(text.replace(',', '.'));
  const invalid = !Number.isFinite(parsed) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max);

  const commit = () => {
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      onCancel?.();
      return;
    }
    let v = parsed;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    v = Math.round(v * 10) / 10;
    setText(String(v));
    if (v !== value) onCommit(v);
    else onCancel?.();
  };

  return (
    <label htmlFor={id} className={compact ? 'flex items-center gap-1' : 'flex flex-col gap-1'}>
      <span className={hideLabel ? 'sr-only' : 'flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400'}>
        {label}
        {help && !hideLabel && <HelpTip term={label} text={help} />}
      </span>
      <span className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          aria-label={label}
          aria-invalid={invalid}
          disabled={disabled}
          className={`input w-full pr-9 tabular-nums ${invalid ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setText(String(value));
              onCancel?.();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              const base = Number.isFinite(parsed) ? parsed : value;
              setText(String(Math.round((base + d) * 10) / 10));
            }
            e.stopPropagation();
          }}
        />
        <span className="pointer-events-none absolute right-2 text-xs text-slate-400">{unit}</span>
      </span>
      {invalid && min !== undefined && max !== undefined && !compact && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400">
          {min}–{max} {unit}
        </span>
      )}
    </label>
  );
}
