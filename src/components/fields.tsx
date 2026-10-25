import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';

interface Common {
  label: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  className?: string;
}

const toFixedClean = (n: number) => String(Number(n.toPrecision(12)));

function display(value: number | null | undefined, percent: boolean): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return toFixedClean(percent ? value * 100 : value);
}

function parse(text: string, percent: boolean, nullable: boolean): number | null | 'invalid' {
  const t = text.trim().replace(/,/g, '').replace(/%$/, '').replace(/−/g, '-');
  if (t === '') return nullable ? null : 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return 'invalid';
  return percent ? Number((n / 100).toPrecision(12)) : n;
}

function Label({ id, label, hideLabel }: { id: string; label: string; hideLabel?: boolean }) {
  return (
    <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
      {label}
    </label>
  );
}

export function NumberField({
  label,
  hint,
  hideLabel,
  className,
  value,
  onChange,
  percent = false,
  nullable = false,
  prefix,
  placeholder,
  min,
}: Common & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  percent?: boolean;
  nullable?: boolean;
  prefix?: string;
  placeholder?: string;
  /** Lowest accepted value; anything below is shown as invalid and not passed on. */
  min?: number;
}) {
  const id = useId();
  const tooLow = (p: number | null | 'invalid') => min != null && typeof p === 'number' && p < min;
  const [text, setText] = useState(() => display(value, percent));
  const parsed = parse(text, percent, nullable);
  useEffect(() => {
    const p = parse(text, percent, nullable);
    const same = p === 'invalid' ? false : p === (value ?? null) || (p != null && value != null && Math.abs(p - value) < 1e-12);
    if (!same && p !== 'invalid') setText(display(value, percent));
  }, [value, percent]);
  const invalid = parsed === 'invalid' || tooLow(parsed);
  const errorText =
    parsed === 'invalid' ? 'Enter a number' : min === 0 ? 'Cannot be negative' : `Enter ${display(min, percent)}${percent ? '%' : ''} or more`;
  const describedBy = [hint ? `${id}-hint` : '', invalid ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className ?? ''}`}>
      <Label id={id} label={label} hideLabel={hideLabel} />
      <div className={`input-wrap${invalid ? ' invalid' : ''}`}>
        {prefix && <span className="adorn" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setText(e.target.value);
            const p = parse(e.target.value, percent, nullable);
            if (p !== 'invalid' && !tooLow(p)) onChange(p);
          }}
          onBlur={() => {
            if (!invalid) setText(display(value, percent));
          }}
        />
        {percent && <span className="adorn" aria-hidden="true">%</span>}
      </div>
      {invalid && (
        <span id={`${id}-err`} className="field-error" role="alert">
          {errorText}
        </span>
      )}
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  hideLabel,
  className,
  value,
  onChange,
  type = 'text',
  placeholder,
}: Common & { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className={`field ${className ?? ''}`}>
      <Label id={id} label={label} hideLabel={hideLabel} />
      <div className="input-wrap">
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  hideLabel,
  className,
  value,
  onChange,
  options,
}: Common & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = useId();
  return (
    <div className={`field ${className ?? ''}`}>
      <Label id={id} label={label} hideLabel={hideLabel} />
      <div className="input-wrap">
        <select id={id} value={value} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function CheckField({
  label,
  hint,
  hideLabel,
  className,
  checked,
  onChange,
}: Common & { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className={`field check ${className ?? ''}`}>
      <div className="check-row">
        <input id={id} type="checkbox" checked={checked} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.checked)} />
        <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
          {label}
        </label>
      </div>
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  );
}
