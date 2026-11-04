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

export const calculatePriceFromFinal = (
  finalPrice: number,
  vatRate: number | string,
): PriceBreakdownValues => {
  const final = Number.isFinite(finalPrice) ? roundMoney(finalPrice) : 0
  const rate = Number(vatRate)
  const safeRate = Number.isFinite(rate) ? rate : 0
  const base = roundMoney(final / (1 + safeRate))

  return {
    base,
    vatRate: safeRate,
    vat: roundMoney(final - base),
    total: final,
  }
}

export const calculatePriceForMode = (
  value: number,
  vatRate: number | string,
  includesTax: boolean,
): PriceBreakdownValues =>
  includesTax
    ? calculatePriceFromFinal(value, vatRate)
    : calculatePriceBreakdown(value, vatRate)
