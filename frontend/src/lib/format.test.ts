import { describe, expect, it } from 'vitest'

import {
  formatCurrencyCOP,
  formatNumber,
  formatThousands,
  parseThousands,
  toISODate,
} from '@/lib/format'

describe('format helpers', () => {
  it('convierte una fecha local al formato ISO de input date', () => {
    expect(toISODate(new Date(2026, 9, 30))).toBe('2026-10-30')
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('retorna cero para valores numéricos inválidos', () => {
    expect(formatNumber('no-numero')).toBe('0')
    expect(formatCurrencyCOP('no-numero')).toBe('$ 0')
  })

  it('formatea números y moneda', () => {
    expect(formatNumber(1234.5, 1)).toBe('1.234,5')
    expect(formatCurrencyCOP(43197)).toContain('43.197')
  })

  it('formatea y lee separadores de miles', () => {
    expect(formatThousands(10000)).toBe('10.000')
    expect(formatThousands('1234567')).toBe('1.234.567')
    expect(parseThousands('10.000')).toBe(10000)
    expect(parseThousands('')).toBe(0)
  })
})
