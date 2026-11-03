import { describe, expect, it } from 'vitest'

import { calculatePriceBreakdown } from '@/lib/pricing'

describe('calculatePriceBreakdown', () => {
  it('calcula IVA y total con decimales', () => {
    expect(calculatePriceBreakdown(1000.75, 0.19)).toEqual({
      base: 1000.75,
      vatRate: 0.19,
      vat: 190.14,
      total: 1190.89,
    })
  })

  it('maneja valores inválidos y tarifas en cero', () => {
    expect(calculatePriceBreakdown(Number.NaN, '0')).toEqual({
      base: 0,
      vatRate: 0,
      vat: 0,
      total: 0,
    })
  })
})
