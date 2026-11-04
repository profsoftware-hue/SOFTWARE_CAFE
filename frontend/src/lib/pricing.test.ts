import { describe, expect, it } from 'vitest'

import { calculatePriceBreakdown, calculatePriceFromFinal } from '@/lib/pricing'

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

describe('calculatePriceFromFinal', () => {
  it('separa el IVA cuando el precio final ya lo incluye', () => {
    expect(calculatePriceFromFinal(90000, 0.19)).toEqual({
      base: 75630.25,
      vatRate: 0.19,
      vat: 14369.75,
      total: 90000,
    })
  })

  it('maneja IVA del 5% y productos exentos', () => {
    expect(calculatePriceFromFinal(90000, 0.05)).toEqual({
      base: 85714.29,
      vatRate: 0.05,
      vat: 4285.71,
      total: 90000,
    })
    expect(calculatePriceFromFinal(10000, 0)).toEqual({
      base: 10000,
      vatRate: 0,
      vat: 0,
      total: 10000,
    })
  })
})
