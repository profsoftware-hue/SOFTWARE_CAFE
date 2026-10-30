import { apiClient } from '@/api/client'
import type {
  CreateAdjustmentPayload,
  CreatePurchasePayload,
  CreateSalePayload,
  CurrentStockRow,
  InventoryDocument,
  KardexRow,
  PosQuoteResponse,
  SaleReceipt,
} from '@/types/api'

export const createPurchase = async (payload: CreatePurchasePayload): Promise<InventoryDocument> => {
  const { data } = await apiClient.post<InventoryDocument>('/inventory/purchases', payload)
  return data
}

export const createSale = async (payload: CreateSalePayload): Promise<InventoryDocument> => {
  const { data } = await apiClient.post<InventoryDocument>('/inventory/sales', payload)
  return data
}

export const getSaleReceipt = async (saleId: number): Promise<SaleReceipt> => {
  const { data } = await apiClient.get<SaleReceipt>(`/inventory/sales/${saleId}/receipt`)
  return data
}

export const createAdjustment = async (payload: CreateAdjustmentPayload): Promise<InventoryDocument> => {
  const { data } = await apiClient.post<InventoryDocument>('/inventory/adjustments', payload)
  return data
}

export interface PosQuoteRequest {
  items: Array<{
    product_id: number
    quantity: number
    unit_price_excl_tax?: number
  }>
}

export const getPosQuote = async (payload: PosQuoteRequest): Promise<PosQuoteResponse> => {
  const { data } = await apiClient.post<PosQuoteResponse>('/inventory/pos/quote', payload)
  return data
}

export interface KardexParams {
  product_id?: number
  warehouse_id?: number
  movement_type?: string
  offset?: number
  limit?: number
}

export const listKardex = async (params: KardexParams): Promise<KardexRow[]> => {
  const { data } = await apiClient.get<KardexRow[]>('/inventory/kardex', { params })
  return data
}

export interface CurrentStockParams {
  search?: string
  warehouse_id?: number
  low_only?: boolean
  date_from?: string
  date_to?: string
}

export const listCurrentStock = async (params: CurrentStockParams): Promise<CurrentStockRow[]> => {
  const { data } = await apiClient.get<CurrentStockRow[]>('/inventory/stock/current', { params })
  return data
}
