import { apiClient } from '@/api/client'
import type { CorrectionSale, QuantityCorrectionResult, RecentSale } from '@/types/api'

export const listCorrectionSales = async (limit = 30): Promise<RecentSale[]> => {
  const { data } = await apiClient.get<RecentSale[]>('/corrections/sales', {
    params: { limit },
  })
  return data
}

export const getCorrectionSale = async (saleId: number): Promise<CorrectionSale> => {
  const { data } = await apiClient.get<CorrectionSale>(`/corrections/sales/${saleId}`)
  return data
}

export interface SaleQuantityCorrectionPayload {
  corrected_quantity: number
  reason: string
}

export const correctSaleItem = async (
  saleId: number,
  saleItemId: number,
  payload: SaleQuantityCorrectionPayload,
): Promise<QuantityCorrectionResult> => {
  const { data } = await apiClient.post<QuantityCorrectionResult>(
    `/corrections/sales/${saleId}/items/${saleItemId}`,
    payload,
  )
  return data
}

export interface InventoryQuantityCorrectionPayload {
  product_id: number
  warehouse_id: number
  corrected_quantity: number
  reason: string
}

export const correctInventory = async (
  payload: InventoryQuantityCorrectionPayload,
): Promise<QuantityCorrectionResult> => {
  const { data } = await apiClient.post<QuantityCorrectionResult>('/corrections/inventory', payload)
  return data
}
