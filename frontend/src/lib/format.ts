export const formatCurrencyCOP = (value: number | string): string => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return '$ 0'

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(numeric)
}

export const formatThousands = (value: number | string): string => {
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(digits))
}

export const parseThousands = (value: string): number => {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export const formatNumber = (value: number | string, decimals = 2): string => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return '0'

  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(numeric)
}

export const formatDateTime = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export const toISODate = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
