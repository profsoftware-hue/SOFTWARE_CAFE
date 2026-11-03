export interface PriceBreakdownValues {
  base: number
  vatRate: number
  vat: number
  total: number
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100

export const calculatePriceBreakdown = (
  basePrice: number,
  vatRate: number | string,
): PriceBreakdownValues => {
  const base = Number.isFinite(basePrice) ? basePrice : 0
  const rate = Number(vatRate)
  const safeRate = Number.isFinite(rate) ? rate : 0
  const total = roundMoney(base * (1 + safeRate))

  return {
    base,
    vatRate: safeRate,
    vat: roundMoney(total - base),
    total,
  }
}
