import type { CustomerType, DocumentType } from '@/types/api'

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  NATURAL: 'Persona natural',
  COMPANY: 'Persona jurídica',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  NIT: 'NIT',
  TI: 'Tarjeta de identidad',
  PPT: 'PPT',
  PASSPORT: 'Pasaporte',
}

export const CUSTOMER_TYPE_OPTIONS = (Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map(
  (value) => ({ value, label: CUSTOMER_TYPE_LABELS[value] }),
)

export const DOCUMENT_TYPE_OPTIONS = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map(
  (value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }),
)

export const formatDocument = (
  documentType: DocumentType | null | undefined,
  documentNumber: string | null | undefined,
): string => {
  const number = (documentNumber ?? '').trim()
  if (!documentType || !number) return number
  return `${documentType}.${number}`
}
