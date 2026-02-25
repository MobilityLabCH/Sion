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
  referenceValue?: number;
  referenceLabel?: string;
}

export default function SliderField({
  label, value, min, max, step = 0.1, unit = '', hint, onChange, formatValue,
  referenceValue, referenceLabel
}: SliderFieldProps) {
  const displayValue = formatValue ? formatValue(value) : value.toFixed(step < 1 ? 1 : 0);
  const pct = ((value - min) / (max - min)) * 100;
  const refPct = referenceValue !== undefined ? ((referenceValue - min) / (max - min)) * 100 : null;
  const isAboveRef = referenceValue !== undefined && value > referenceValue;
  const isBelowRef = referenceValue !== undefined && value < referenceValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-ink-700">{label}</label>
        <div className="flex items-center gap-2">
          {referenceValue !== undefined && value !== referenceValue && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isAboveRef ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {isAboveRef ? '▲' : '▼'} vs {referenceLabel || 'ref'}
            </span>
          )}
          <span className={`text-sm font-semibold font-mono ${
            isAboveRef ? 'text-orange-600' : isBelowRef ? 'text-blue-600' : 'text-accent'
          }`}>
            {displayValue}{unit}
          </span>
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="slider-track w-full"
          style={{
            background: `linear-gradient(to right, rgb(91,79,255) ${pct}%, #e2e8f0 ${pct}%)`,
          }}
        />
        {/* Reference marker */}
        {refPct !== null && (
          <div
            className="absolute top-0 bottom-0 flex items-center pointer-events-none"
            style={{ left: `calc(${refPct}% - 1px)` }}
          >
            <div className="w-0.5 h-4 bg-ink-300 rounded-full" title={`${referenceLabel}: ${referenceValue}${unit}`} />
          </div>
        )}
      </div>

      <div className="flex justify-between text-xs text-ink-300">
        <span>{min}{unit}</span>
        {referenceValue !== undefined && (
          <span className="text-ink-400">
            ┊ {referenceLabel || 'ref'}: {referenceValue}{unit}
          </span>
        )}
        <span>{max}{unit}</span>
      </div>

      {hint && <p className="text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
