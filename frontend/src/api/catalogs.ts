import { apiClient } from '@/api/client'
import type { Category, Customer, CustomerType, DocumentType, Supplier, Warehouse } from '@/types/api'

export interface CustomerCreatePayload {
  customer_type: CustomerType
  first_name?: string | null
  last_name?: string | null
  business_name?: string | null
  document_type: DocumentType
  document_number: string
  phone: string
  email: string
  address?: string | null
}

export const listCategories = async (): Promise<Category[]> => {
  const { data } = await apiClient.get<Category[]>('/catalogs/categories')
  return data
}

export const listSuppliers = async (): Promise<Supplier[]> => {
  const { data } = await apiClient.get<Supplier[]>('/catalogs/suppliers')
  return data
}

export const listCustomers = async (): Promise<Customer[]> => {
  const { data } = await apiClient.get<Customer[]>('/catalogs/customers', {
    params: { limit: 300 },
  })
  return data
}

export const createCustomer = async (payload: CustomerCreatePayload): Promise<Customer> => {
  const { data } = await apiClient.post<Customer>('/catalogs/customers', payload)
  return data
}

export const lookupCustomer = async (
  documentType: DocumentType,
  documentNumber: string,
): Promise<Customer> => {
  const { data } = await apiClient.get<Customer>('/catalogs/customers/lookup', {
    params: { document_type: documentType, document_number: documentNumber },
  })
  return data
}

export const listWarehouses = async (): Promise<Warehouse[]> => {
  const { data } = await apiClient.get<Warehouse[]>('/catalogs/warehouses')
  return data
}
