import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type TableColumn = string | { label: string; className?: string }

interface TableProps {
  columns: TableColumn[]
  children: ReactNode
  className?: string
}

export const Table = ({ columns, children, className }: TableProps) => {
  return (
    <div className={cn('w-full max-w-full overflow-auto rounded-lg border border-slate-200', className)}>
      <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => {
              const label = typeof column === 'string' ? column : column.label
              const columnClassName = typeof column === 'string' ? undefined : column.className
              return (
                <th key={label} className={cn('whitespace-nowrap px-2.5 py-2 font-semibold sm:px-3', columnClassName)}>
                  {label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">{children}</tbody>
      </table>
    </div>
  )
}
