interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'green' | 'orange' | 'red' | 'accent';
  description?: string;
  className?: string;
}

const colorMap = {
  default: 'bg-white border-ink-100',
  green: 'bg-green-50 border-green-200',
  orange: 'bg-amber-50 border-amber-200',
  red: 'bg-red-50 border-red-200',
  accent: 'bg-accent-50 border-accent-200',
};

const valueColorMap = {
  default: 'text-ink',
  green: 'text-green-700',
  orange: 'text-amber-700',
  red: 'text-red-700',
  accent: 'text-accent-700',
};

const trendIcons = { up: '↑', down: '↓', neutral: '→' };

export default function KPICard({
  label, value, unit, trend, color = 'default', description, className = ''
}: KPICardProps) {
  return (
    <div className={`card p-5 ${colorMap[color]} ${className}`}>
      <div className="label-sm mb-2">{label}</div>
      <div className={`text-3xl font-display font-medium ${valueColorMap[color]} flex items-baseline gap-1`}>
        {value}
        {unit && <span className="text-base font-sans font-normal text-ink-400">{unit}</span>}
        {trend && (
          <span className={`text-lg ml-1 ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-ink-400'}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
