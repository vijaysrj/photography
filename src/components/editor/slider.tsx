"use client";

/** A labelled slider. The fill grows from zero; double-click (or double-tap) the label to reset. */
export function Slider({
  label,
  value,
  min = -100,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const zero = min < 0 ? 0 : min;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const a = pct(Math.min(zero, value));
  const b = pct(Math.max(zero, value));
  const id = `s-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="group">
      <div className="flex items-baseline justify-between text-xs">
        <label htmlFor={id} onDoubleClick={() => onChange(zero)} className="cursor-default text-mute select-none" title="Double-click to reset">
          {label}
        </label>
        <span className={`tabular-nums ${value === zero ? "text-faint" : "text-paper"}`}>
          {value > 0 && min < 0 ? "+" : ""}
          {Number.isInteger(step) ? value : value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line" />
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brass" style={{ left: `${a}%`, width: `${b - a}%` }} />
        {min < 0 && <div className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-faint" style={{ left: `${pct(0)}%` }} />}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={() => onChange(zero)}
          className="slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
