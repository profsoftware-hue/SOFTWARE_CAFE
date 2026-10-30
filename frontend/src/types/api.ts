export type RoleCode = 'ADMIN' | 'SELLER' | 'WAREHOUSE'

export interface Role {
  id: number
  code: RoleCode
  name: string
}

export interface User {
  id: number
  full_name: string
  email: string
  username: string
  is_active: boolean
  created_at: string
  roles: Role[]
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user_id: number
  username: string
  roles: RoleCode[]
}

export interface BootstrapAdminPayload {
  full_name: string
  email: string
  username: string
  password: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  document_number: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean
}

export interface Customer {
  id: number
  name: string
  document_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean
}

export interface Warehouse {
  id: number
  code: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category_id: number | null
  supplier_id: number | null
  unit: string
  cost_price: string
  sale_price_excl_tax: string
  vat_rate: string
  final_price_incl_tax: string
  min_stock: string
  image_path: string | null
  image_url: string | null
  image_mime_type: string | null
  image_size_bytes: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryDocument {
  id: number
  number: string
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
  subtotal?: string | null
  tax_total?: string | null
  total?: string | null
  created_at: string
}

export interface PurchaseItemInput {
  product_id: number
  quantity: number
  unit_cost: number
  vat_rate: number
}

export interface CreatePurchasePayload {
  purchase_number?: string | null
  supplier_id: number
  warehouse_id: number
  purchased_at?: string | null
  note?: string | null
  items: PurchaseItemInput[]
  confirm: boolean
}

export interface SaleItemInput {
  product_id: number
  quantity: number
  unit_price_excl_tax?: number | null
}

export interface CreateSalePayload {
  sale_number?: string | null
  warehouse_id: number
  customer_id?: number | null
  sold_at?: string | null
  payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT'
  note?: string | null
  items: SaleItemInput[]
  confirm: boolean
}

export interface AdjustmentItemInput {
  product_id: number
  quantity: number
  unit_cost?: number | null
  note?: string | null
}

export interface CreateAdjustmentPayload {
  adjustment_number?: string | null
  adjustment_type: 'CUSTOMER_RETURN' | 'ADJUSTMENT_IN' | 'SHRINKAGE' | 'DAMAGE' | 'ADJUSTMENT_OUT'
  warehouse_id: number
  reference_sale_id?: number | null
  adjusted_at?: string | null
  reason: string
  note?: string | null
  items: AdjustmentItemInput[]
  confirm: boolean
}

export interface PosQuoteLine {
  product_id: number
  sku: string
  name: string
  image_path: string | null
  quantity: string
  unit_price_excl_tax: string
  vat_rate: string
  line_subtotal: string
  line_tax: string
  line_total: string
}

export interface PosQuoteResponse {
  lines: PosQuoteLine[]
  subtotal: string
  tax_total: string
  total: string
}

export interface KardexRow {
  id: number
  moved_at: string
  warehouse_id: number
  product_id: number
  movement_type: string
  direction: 'IN' | 'OUT'
  quantity: string
  signed_quantity: string
  unit_cost: string | null
  reason: string | null
  note: string | null
  origin_type: string
  origin_id: number
  origin_item_id: number | null
}

export interface CurrentStockRow {
  product_id: number
  sku: string
  barcode: string | null
  product_name: string
  image_path: string | null
  warehouse_id: number
  warehouse_code: string
  warehouse_name: string
  current_stock: string
  min_stock: string
  is_low_stock: boolean
  cost_price: string
  sale_price_excl_tax: string
  vat_rate: string
  stock_value: string
  sold_quantity: string
}

export interface InventoryValue {
  total_inventory_value: string
}

export interface TopProduct {
  product_id: number
  sku: string
  product_name: string
  units_sold: string
  subtotal: string
  tax_total: string
  total: string
}

export interface SalesRange {
  date_from: string
  date_to: string
  tickets: number
  subtotal: string
  tax_total: string
  total: string
}

export interface SaleReceiptItem {
  product_name: string
  barcode: string | null
  quantity: string
  unit_price_excl_tax: string
  vat_rate: string
  line_subtotal: string
  line_tax: string
  line_total: string
}

export interface SaleReceipt {
  sale_id: number
  sale_number: string
  sold_at: string
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
  payment_method: string
  customer_name: string | null
  warehouse_name: string
  seller_name: string | null
  company_name: string
  company_nit: string | null
  company_address: string | null
  company_phone: string | null
  subtotal: string
  tax_total: string
  total: string
  items: SaleReceiptItem[]
}

export interface DailyClosingItem {
  product_name: string
  sku: string | null
  quantity: string
  subtotal: string
  tax_total: string
  total: string
}

export interface DailyClosing {
  date_from: string
  date_to: string
  tickets: number
  subtotal: string
  tax_total: string
  total: string
  company_name: string
  items: DailyClosingItem[]
}
