import { describe, expect, it } from 'vitest'

import {
  formatCurrencyCOP,
  formatCurrencyCOPRounded,
  formatDecimalInput,
  formatNumber,
  formatThousands,
  parseDecimal,
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

  it('formatea números y moneda con decimales', () => {
    expect(formatNumber(1234.5, 1)).toBe('1.234,5')
    expect(formatCurrencyCOP(43197)).toContain('43.197')
    expect(formatCurrencyCOP(1234.56)).toContain('1.234,56')
    expect(formatCurrencyCOPRounded(1234.56)).toContain('1.235')
  })

  it('formatea y lee separadores de miles', () => {
    expect(formatThousands(10000)).toBe('10.000')
    expect(formatThousands('1234567')).toBe('1.234.567')
    expect(parseThousands('10.000')).toBe(10000)
    expect(parseThousands('')).toBe(0)
  })

  it('formatea y lee valores decimales', () => {
    expect(formatDecimalInput('1234,5', 2)).toBe('1.234,5')
    expect(formatDecimalInput('1234,567', 2)).toBe('1.234,56')
    expect(formatDecimalInput('10.000', 2)).toBe('10.000')
    expect(formatDecimalInput('0,75', 3)).toBe('0,75')
    expect(parseDecimal('1.234,56')).toBe(1234.56)
    expect(parseDecimal('0,75')).toBe(0.75)
    expect(parseDecimal('10.000')).toBe(10000)
    expect(parseDecimal('')).toBe(0)
  })
})
