import { apiClient } from '@/api/client'
import type { Product } from '@/types/api'

export interface ProductListParams {
  search?: string
  category_id?: number
  supplier_id?: number
  is_active?: boolean
  offset?: number
  limit?: number
}

export interface ProductFormPayload {
  sku: string
  barcode?: string
  name: string
  description?: string
  category_id?: number
  supplier_id?: number
  unit: string
  cost_price: string
  sale_price_excl_tax: string
  vat_rate: string
  min_stock: string
  is_active: boolean
  image?: File | null
  remove_image?: boolean
}

const toFormData = (payload: ProductFormPayload): FormData => {
  const data = new FormData()
  data.append('sku', payload.sku)
  data.append('name', payload.name)
  data.append('unit', payload.unit)
  data.append('cost_price', payload.cost_price)
  data.append('sale_price_excl_tax', payload.sale_price_excl_tax)
  data.append('vat_rate', payload.vat_rate)
  data.append('min_stock', payload.min_stock)
  data.append('is_active', payload.is_active ? 'true' : 'false')

  if (payload.barcode) data.append('barcode', payload.barcode)
  if (payload.description) data.append('description', payload.description)
  if (payload.category_id) data.append('category_id', String(payload.category_id))
  if (payload.supplier_id) data.append('supplier_id', String(payload.supplier_id))
  if (payload.image) data.append('image', payload.image)
  if (payload.remove_image) data.append('remove_image', 'true')

  return data
}

export const listProducts = async (params: ProductListParams): Promise<Product[]> => {
  const { data } = await apiClient.get<Product[]>('/products', { params })
  return data
}

export const createProduct = async (payload: ProductFormPayload): Promise<Product> => {
  const { data } = await apiClient.post<Product>('/products', toFormData(payload), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const updateProduct = async (productId: number, payload: ProductFormPayload): Promise<Product> => {
  const { data } = await apiClient.put<Product>(`/products/${productId}`, toFormData(payload), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const replaceProductImage = async (productId: number, image: File): Promise<Product> => {
  const formData = new FormData()
  formData.append('image', image)
  const { data } = await apiClient.post<Product>(`/products/${productId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const deleteProduct = async (productId: number): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/products/${productId}`)
  return data
}

export interface QuickProductPayload {
  name: string
  quantity: number
  sku?: string
  barcode?: string
  cost_price?: number
  sale_price_excl_tax?: number
  vat_rate?: number
  min_stock?: number
  warehouse_id?: number
}

export const createQuickProduct = async (payload: QuickProductPayload): Promise<Product> => {
  const { data } = await apiClient.post<Product>('/products/quick', payload)
  return data
}

export const addProductStock = async (
  productId: number,
  quantity: number,
  warehouseId?: number,
): Promise<Product> => {
  const { data } = await apiClient.post<Product>(`/products/${productId}/stock`, {
    quantity,
    warehouse_id: warehouseId,
  })
  return data
}

export interface ProductPatchPayload {
  name?: string
  sku?: string
  barcode?: string | null
  cost_price?: number
  sale_price_excl_tax?: number
  vat_rate?: number
  min_stock?: number
  is_active?: boolean
}

export const patchProduct = async (productId: number, payload: ProductPatchPayload): Promise<Product> => {
  const { data } = await apiClient.patch<Product>(`/products/${productId}`, payload)
  return data
}
