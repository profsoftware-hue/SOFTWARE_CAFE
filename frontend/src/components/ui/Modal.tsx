import type { ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export const Modal = ({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: ModalProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <section
        className={cn(
          'max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl scrollbar-thin',
          className,
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        {children}
      </section>
    </div>
  )
}
