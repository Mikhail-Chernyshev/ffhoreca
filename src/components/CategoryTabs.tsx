import type { CategoryFilter } from '../data/types'

const TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'places', label: 'Места' },
  { id: 'cities', label: 'Города' },
  { id: 'lodging', label: 'Жильё' },
  { id: 'food', label: 'Еда' },
  { id: 'bar', label: 'Бары' },
  { id: 'airport', label: 'Аэропорты' },
]

type Props = {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
}

export function CategoryTabs({ value, onChange }: Props) {
  return (
    <div className="category-tabs" role="tablist" aria-label="Категории на карте">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`category-tabs__btn${value === tab.id ? ' category-tabs__btn--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
