import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-400',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border border-slate-200',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed',
          variantClasses[variant],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? 'Procesando...' : children}
      </button>
    )
  },
)

Button.displayName = 'Button'
