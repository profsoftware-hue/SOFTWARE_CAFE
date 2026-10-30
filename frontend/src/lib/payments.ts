import type { PaymentMethod } from '@/types/api'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  QR: 'QR',
  CARD: 'Tarjeta',
  MIXED: 'Mixto',
  CREDIT: 'Crédito',
}

export const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: PAYMENT_METHOD_LABELS.CASH },
  { value: 'TRANSFER', label: PAYMENT_METHOD_LABELS.TRANSFER },
  { value: 'QR', label: PAYMENT_METHOD_LABELS.QR },
  { value: 'CARD', label: PAYMENT_METHOD_LABELS.CARD },
  { value: 'MIXED', label: PAYMENT_METHOD_LABELS.MIXED },
  { value: 'CREDIT', label: PAYMENT_METHOD_LABELS.CREDIT },
]
