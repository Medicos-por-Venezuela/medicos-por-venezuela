import React from 'react'

export type Column<T> = {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  /** Marks the column as the primary label shown in the mobile card title. */
  primary?: boolean
  /** Renders this column value as a badge in the top-right corner of mobile cards. */
  mobileBadge?: boolean
}

type Props<T> = {
  items: T[]
  getKey: (item: T) => string
  columns: Column<T>[]
  emptyMessage?: string
}

export default function DataTable<T>({ items, getKey, columns, emptyMessage }: Props<T>) {
  if (items.length === 0) {
    return <p className="data-empty">{emptyMessage ?? 'No hay datos.'}</p>
  }

  const primaryCol = columns.find((c) => c.primary)
  const badgeCol = columns.find((c) => c.mobileBadge)
  const bodyColumns = columns.filter((c) => !c.primary && !c.mobileBadge)

  return (
    <>
      {/* Desktop: table */}
      <div className="data-table">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={getKey(item)}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="data-cards">
        {items.map((item) => (
          <li key={getKey(item)} className="data-card">
            <div className="data-card-head">
              {primaryCol && <span className="data-card-title">{primaryCol.render(item)}</span>}
              {badgeCol && <span className="data-card-badge">{badgeCol.render(item)}</span>}
            </div>
            <dl className="data-card-body">
              {bodyColumns.map((col) => (
                <div key={col.key} className="data-card-row">
                  <dt>{col.header}</dt>
                  <dd>{col.render(item)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
