import { apiClient } from '@/api/client'
import type { CurrentStockRow, DailyClosing, InventoryValue, SalesRange, TopProduct } from '@/types/api'

export const getInventoryValue = async (): Promise<InventoryValue> => {
  const { data } = await apiClient.get<InventoryValue>('/reports/inventory-value')
  return data
}

export const getLowStock = async (warehouse_id?: number): Promise<CurrentStockRow[]> => {
  const { data } = await apiClient.get<CurrentStockRow[]>('/reports/low-stock', {
    params: warehouse_id ? { warehouse_id } : undefined,
  })
  return data
}

export const getTopProducts = async (
  date_from?: string,
  date_to?: string,
  limit = 10,
): Promise<TopProduct[]> => {
  const { data } = await apiClient.get<TopProduct[]>('/reports/top-products', {
    params: {
      date_from,
      date_to,
      limit,
    },
  })
  return data
}

export const getSalesRange = async (date_from: string, date_to: string): Promise<SalesRange> => {
  const { data } = await apiClient.get<SalesRange>('/reports/sales-range', {
    params: { date_from, date_to },
  })
  return data
}

export const getDailyClosing = async (dateFrom: string, dateTo: string): Promise<DailyClosing> => {
  const { data } = await apiClient.get<DailyClosing>('/reports/daily-closing', {
    params: { date_from: dateFrom, date_to: dateTo },
  })
  return data
}
