import { useMemo } from 'react'
import {
  categoryTabCounts,
  formatTabCount,
} from '../data/selectors'
import type { Catalog, CategoryFilter } from '../data/types'
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
  catalog: Catalog
}

export function CategoryTabs({ value, onChange, catalog }: Props) {
  const t = useT()
  const counts = useMemo(() => categoryTabCounts(catalog), [catalog])

  return (
    <div className="category-tabs" role="tablist" aria-label={t('category.ariaTablist')}>
      {TAB_IDS.map((id) => {
        const countLabel = formatTabCount(counts[id])
        const label = t(`category.tab.${id}`)
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value === id}
            aria-label={`${label}, ${countLabel}`}
            className={`category-tabs__btn${value === id ? ' category-tabs__btn--active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span className="category-tabs__label">{label}</span>
            <span className="category-tabs__count" aria-hidden="true">
              {countLabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
