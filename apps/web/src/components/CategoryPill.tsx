type Category = 'vert' | 'orange' | 'rouge';

interface CategoryPillProps {
  category: Category;
  size?: 'sm' | 'md';
}

const config: Record<Category, { label: string; dot: string; pill: string }> = {
  vert: {
    label: 'Fort potentiel',
    dot: 'bg-green-500',
    pill: 'bg-green-50 text-green-700 border-green-200',
  },
  orange: {
    label: 'Potentiel modéré',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  rouge: {
    label: 'Faible potentiel',
    dot: 'bg-red-500',
    pill: 'bg-red-50 text-red-700 border-red-200',
  },
};

export default function CategoryPill({ category, size = 'sm' }: CategoryPillProps) {
  const { label, dot, pill } = config[category];
  return (
    <span className={`inline-flex items-center gap-1.5 border font-semibold rounded-full ${pill} ${
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
