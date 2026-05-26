import type { CategoryFilter } from '../data/types'
import { useT } from '../i18n/LocaleContext'

const TAB_IDS: CategoryFilter[] = [
  'all',
  'places',
  'cities',
  'lodging',
  'food',
  'bar',
  'airport',
]

type Props = {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
}

export function CategoryTabs({ value, onChange }: Props) {
  const t = useT()

  return (
    <div className="category-tabs" role="tablist" aria-label={t('category.ariaTablist')}>
      {TAB_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={`category-tabs__btn${value === id ? ' category-tabs__btn--active' : ''}`}
          onClick={() => onChange(id)}
        >
          {t(`category.tab.${id}`)}
        </button>
      ))}
    </div>
  )
}
