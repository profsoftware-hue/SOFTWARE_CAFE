import { describe, expect, it } from 'vitest'

import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/payments'

describe('payment method catalog', () => {
  it('incluye todos los medios de pago del negocio', () => {
    expect(PAYMENT_METHOD_OPTIONS.map((option) => option.value)).toEqual([
      'CASH',
      'TRANSFER',
      'QR',
      'CARD',
      'MIXED',
      'CREDIT',
    ])
  })

  it('traduce cada método al español', () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe('Efectivo')
    expect(PAYMENT_METHOD_LABELS.TRANSFER).toBe('Transferencia')
    expect(PAYMENT_METHOD_LABELS.QR).toBe('QR')
    expect(PAYMENT_METHOD_LABELS.CARD).toBe('Tarjeta')
    expect(PAYMENT_METHOD_LABELS.MIXED).toBe('Mixto')
    expect(PAYMENT_METHOD_LABELS.CREDIT).toBe('Crédito')
  })

  it('no repite métodos en las opciones del POS', () => {
    const values = PAYMENT_METHOD_OPTIONS.map((option) => option.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
