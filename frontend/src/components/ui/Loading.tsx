export const Loading = ({ message = 'Cargando información...' }: { message?: string }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-blue-600" />
      <span>{message}</span>
    </div>
  )
}
