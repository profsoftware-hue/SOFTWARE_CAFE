interface EmptyStateProps {
  title: string
  description?: string
}

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
    <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
    {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
  </div>
)
