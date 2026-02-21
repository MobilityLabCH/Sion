interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}

export default function SliderField({
  label, value, min, max, step = 0.1, unit = '', hint, onChange, formatValue
}: SliderFieldProps) {
  const displayValue = formatValue ? formatValue(value) : value.toFixed(step < 1 ? 1 : 0);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink">{label}</label>
        <span className="font-mono text-sm font-semibold text-accent bg-accent-50 px-2 py-0.5 rounded-md">
          {displayValue}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(to right, #5b4fff 0%, #5b4fff ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-ink-400 mt-0.5">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
      {hint && <p className="text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
