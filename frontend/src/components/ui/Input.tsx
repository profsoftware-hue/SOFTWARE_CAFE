import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const controlId = id ?? props.name

    return (
      <label className="block space-y-1.5">
        {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
        <input
          ref={ref}
          id={controlId}
          className={cn(
            'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200',
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : '',
            className,
          )}
          {...props}
        />
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        {!error && helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
      </label>
    )
  },
)

Input.displayName = 'Input'
