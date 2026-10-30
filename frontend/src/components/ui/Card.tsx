import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface CardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}

export const Card = ({ title, subtitle, children, className, actions }: CardProps) => {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {(title || subtitle || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="text-base font-semibold text-slate-800 sm:text-lg">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  )
}
