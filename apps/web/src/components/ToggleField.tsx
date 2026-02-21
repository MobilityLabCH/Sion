interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}

export default function ToggleField({ label, description, value, onChange, badge }: ToggleFieldProps) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{label}</span>
          {badge && (
            <span className="text-xs font-medium text-accent bg-accent-50 px-2 py-0.5 rounded-full border border-accent-200">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 ${
          value ? 'bg-accent' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
