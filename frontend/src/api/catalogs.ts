import { apiClient } from '@/api/client'
import type { Category, Customer, Supplier, Warehouse } from '@/types/api'

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

export const listWarehouses = async (): Promise<Warehouse[]> => {
  const { data } = await apiClient.get<Warehouse[]>('/catalogs/warehouses')
  return data
}
