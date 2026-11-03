import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_OPTIONS,
} from '@/lib/customers'

describe('customer catalogs', () => {
  it('incluye los tipos de documento usados en facturación', () => {
    expect(DOCUMENT_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'CC',
      'CE',
      'NIT',
      'TI',
      'PPT',
      'PASSPORT',
    ])
    expect(DOCUMENT_TYPE_LABELS.CC).toBe('Cédula de ciudadanía')
    expect(DOCUMENT_TYPE_LABELS.NIT).toBe('NIT')
    expect(DOCUMENT_TYPE_LABELS.TI).toBe('Tarjeta de identidad')
    expect(DOCUMENT_TYPE_LABELS.PPT).toBe('PPT')
  })

  it('distingue persona natural y jurídica', () => {
    expect(CUSTOMER_TYPE_LABELS.NATURAL).toBe('Persona natural')
    expect(CUSTOMER_TYPE_LABELS.COMPANY).toBe('Persona jurídica')
  })
})
