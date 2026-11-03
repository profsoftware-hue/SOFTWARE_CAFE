export const formatCurrencyCOP = (value: number | string): string => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return '$ 0'

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

/**
 * Formatea mientras se escribe usando la convención colombiana:
 * punto para miles y coma para decimales.
 */
export const formatDecimalInput = (value: string, decimals = 2): string => {
  const cleaned = value.replace(/[^\d.,]/g, '')
  if (!cleaned) return ''

  const commaIndex = cleaned.indexOf(',')
  const integerRaw = commaIndex >= 0 ? cleaned.slice(0, commaIndex) : cleaned
  const fractionRaw = commaIndex >= 0 ? cleaned.slice(commaIndex + 1) : ''
  const integerDigits = integerRaw.replace(/\D/g, '')
  const fractionDigits = fractionRaw.replace(/\D/g, '').slice(0, decimals)
  const formattedInteger = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(Number(integerDigits || '0'))

  return commaIndex >= 0 ? `${formattedInteger},${fractionDigits}` : formattedInteger
}

export const parseDecimal = (value: string): number => {
  const cleaned = value.trim().replace(/\s/g, '')
  if (!cleaned) return 0

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\./g, '')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : 0
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
