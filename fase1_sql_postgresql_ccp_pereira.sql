-- ================================================================
-- CCP Pereira - Fase 1
-- Propuesta de esquema inicial para PostgreSQL
-- NO EJECUTAR sin aprobación explícita del usuario.
-- ================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS ccp;

-- ================================================================
-- ENUMS
-- ================================================================

CREATE TYPE ccp.doc_status AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TYPE ccp.payment_method AS ENUM ('CASH', 'CARD', 'TRANSFER', 'MIXED', 'CREDIT');

CREATE TYPE ccp.movement_type AS ENUM (
  'PURCHASE',
  'CUSTOMER_RETURN',
  'ADJUSTMENT_IN',
  'SALE',
  'SHRINKAGE',
  'DAMAGE',
  'ADJUSTMENT_OUT'
);

CREATE TYPE ccp.adjustment_type AS ENUM (
  'CUSTOMER_RETURN',
  'ADJUSTMENT_IN',
  'SHRINKAGE',
  'DAMAGE',
  'ADJUSTMENT_OUT'
);

-- ================================================================
-- TABLAS MAESTRAS / SEGURIDAD
-- ================================================================

CREATE TABLE ccp.company_profile (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  name VARCHAR(120) NOT NULL DEFAULT 'FUNDACION NUESTRO FUTURO',
  nit VARCHAR(30),
  address TEXT,
  phone VARCHAR(40),
  email VARCHAR(120),
  logo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_company_profile_singleton CHECK (id = 1)
);

CREATE TABLE ccp.roles (
  id SMALLSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ccp.users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ccp.user_roles (
  user_id BIGINT NOT NULL REFERENCES ccp.users(id) ON DELETE CASCADE,
  role_id SMALLINT NOT NULL REFERENCES ccp.roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE ccp.refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES ccp.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- CATÁLOGOS
-- ================================================================

CREATE TABLE ccp.product_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ccp.suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  document_number VARCHAR(30),
  contact_name VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(120),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suppliers_name_doc UNIQUE (name, document_number)
);

CREATE TABLE ccp.customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  document_number VARCHAR(30),
  phone VARCHAR(40),
  email VARCHAR(120),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customers_doc UNIQUE (document_number)
);

CREATE TABLE ccp.warehouses (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ccp.products (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  barcode VARCHAR(60) UNIQUE,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  category_id BIGINT REFERENCES ccp.product_categories(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES ccp.suppliers(id) ON DELETE SET NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'UND',
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price_excl_tax NUMERIC(14,2) NOT NULL,
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.19,
  final_price_incl_tax NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(sale_price_excl_tax * (1 + vat_rate), 2)) STORED,
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  image_path TEXT,
  image_mime_type VARCHAR(80),
  image_size_bytes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_products_cost_price_non_negative CHECK (cost_price >= 0),
  CONSTRAINT chk_products_sale_price_non_negative CHECK (sale_price_excl_tax >= 0),
  CONSTRAINT chk_products_min_stock_non_negative CHECK (min_stock >= 0),
  CONSTRAINT chk_products_vat_rate_valid CHECK (vat_rate IN (0, 0.05, 0.19)),
  CONSTRAINT chk_products_image_size CHECK (
    image_size_bytes IS NULL OR image_size_bytes <= 2097152
  )
);

-- ================================================================
-- TRANSACCIONES: COMPRAS / VENTAS / AJUSTES
-- ================================================================

CREATE TABLE ccp.purchases (
  id BIGSERIAL PRIMARY KEY,
  purchase_number VARCHAR(40) NOT NULL UNIQUE,
  supplier_id BIGINT NOT NULL REFERENCES ccp.suppliers(id) ON DELETE RESTRICT,
  warehouse_id BIGINT NOT NULL REFERENCES ccp.warehouses(id) ON DELETE RESTRICT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status ccp.doc_status NOT NULL DEFAULT 'DRAFT',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_purchases_amounts_non_negative CHECK (
    subtotal >= 0 AND tax_total >= 0 AND total >= 0
  )
);

CREATE TABLE ccp.purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES ccp.purchases(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES ccp.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2) NOT NULL,
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.19,
  line_subtotal NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
  line_tax NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(quantity * unit_cost * vat_rate, 2)) STORED,
  line_total NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(quantity * unit_cost * (1 + vat_rate), 2)) STORED,

  CONSTRAINT chk_purchase_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_purchase_items_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT chk_purchase_items_vat_rate_valid CHECK (vat_rate IN (0, 0.05, 0.19))
);

CREATE TABLE ccp.sales (
  id BIGSERIAL PRIMARY KEY,
  sale_number VARCHAR(40) NOT NULL UNIQUE,
  warehouse_id BIGINT NOT NULL REFERENCES ccp.warehouses(id) ON DELETE RESTRICT,
  customer_id BIGINT REFERENCES ccp.customers(id) ON DELETE SET NULL,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status ccp.doc_status NOT NULL DEFAULT 'DRAFT',
  payment_method ccp.payment_method NOT NULL DEFAULT 'CASH',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_sales_amounts_non_negative CHECK (
    subtotal >= 0 AND tax_total >= 0 AND total >= 0
  )
);

CREATE TABLE ccp.sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES ccp.sales(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES ccp.products(id) ON DELETE RESTRICT,
  product_name_snapshot VARCHAR(180) NOT NULL,
  barcode_snapshot VARCHAR(60),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price_excl_tax NUMERIC(14,2) NOT NULL,
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.19,
  line_subtotal NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(quantity * unit_price_excl_tax, 2)) STORED,
  line_tax NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(quantity * unit_price_excl_tax * vat_rate, 2)) STORED,
  line_total NUMERIC(14,2)
    GENERATED ALWAYS AS (ROUND(quantity * unit_price_excl_tax * (1 + vat_rate), 2)) STORED,

  CONSTRAINT chk_sale_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_sale_items_unit_price_non_negative CHECK (unit_price_excl_tax >= 0),
  CONSTRAINT chk_sale_items_vat_rate_valid CHECK (vat_rate IN (0, 0.05, 0.19))
);

CREATE TABLE ccp.inventory_adjustments (
  id BIGSERIAL PRIMARY KEY,
  adjustment_number VARCHAR(40) NOT NULL UNIQUE,
  adjustment_type ccp.adjustment_type NOT NULL,
  warehouse_id BIGINT NOT NULL REFERENCES ccp.warehouses(id) ON DELETE RESTRICT,
  reference_sale_id BIGINT REFERENCES ccp.sales(id) ON DELETE SET NULL,
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status ccp.doc_status NOT NULL DEFAULT 'DRAFT',
  reason TEXT NOT NULL,
  note TEXT,
  created_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_adjustments_reason_non_empty CHECK (BTRIM(reason) <> '')
);

CREATE TABLE ccp.inventory_adjustment_items (
  id BIGSERIAL PRIMARY KEY,
  adjustment_id BIGINT NOT NULL REFERENCES ccp.inventory_adjustments(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES ccp.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2),
  note TEXT,

  CONSTRAINT chk_adjustment_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_adjustment_items_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0)
);

-- ================================================================
-- INVENTARIO TRAZABLE
-- ================================================================

CREATE TABLE ccp.inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  warehouse_id BIGINT NOT NULL REFERENCES ccp.warehouses(id) ON DELETE RESTRICT,
  product_id BIGINT NOT NULL REFERENCES ccp.products(id) ON DELETE RESTRICT,
  movement_type ccp.movement_type NOT NULL,

  direction VARCHAR(3)
    GENERATED ALWAYS AS (
      CASE
        WHEN movement_type IN ('PURCHASE', 'CUSTOMER_RETURN', 'ADJUSTMENT_IN') THEN 'IN'
        ELSE 'OUT'
      END
    ) STORED,

  quantity NUMERIC(14,3) NOT NULL,

  signed_quantity NUMERIC(14,3)
    GENERATED ALWAYS AS (
      CASE
        WHEN movement_type IN ('PURCHASE', 'CUSTOMER_RETURN', 'ADJUSTMENT_IN') THEN quantity
        ELSE -quantity
      END
    ) STORED,

  unit_cost NUMERIC(14,2),
  reason TEXT,
  note TEXT,

  origin_type VARCHAR(30) NOT NULL,
  origin_id BIGINT NOT NULL,
  origin_item_id BIGINT,

  created_by BIGINT REFERENCES ccp.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_inventory_movements_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_inventory_movements_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0),
  CONSTRAINT chk_inventory_movements_direction CHECK (direction IN ('IN', 'OUT')),
  CONSTRAINT chk_inventory_movements_origin_type CHECK (
    origin_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')
  )
);

CREATE TABLE ccp.inventory_balances (
  product_id BIGINT NOT NULL REFERENCES ccp.products(id) ON DELETE RESTRICT,
  warehouse_id BIGINT NOT NULL REFERENCES ccp.warehouses(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, warehouse_id),
  CONSTRAINT chk_inventory_balances_non_negative CHECK (quantity >= 0)
);

-- ================================================================
-- ÍNDICES
-- ================================================================

CREATE INDEX idx_products_name ON ccp.products (name);
CREATE INDEX idx_products_category ON ccp.products (category_id);
CREATE INDEX idx_products_supplier ON ccp.products (supplier_id);

CREATE INDEX idx_sales_sold_at ON ccp.sales (sold_at);
CREATE INDEX idx_sales_status ON ccp.sales (status);
CREATE INDEX idx_sale_items_product ON ccp.sale_items (product_id);

CREATE INDEX idx_purchases_purchased_at ON ccp.purchases (purchased_at);
CREATE INDEX idx_purchases_status ON ccp.purchases (status);
CREATE INDEX idx_purchase_items_product ON ccp.purchase_items (product_id);

CREATE INDEX idx_inventory_movements_product_date ON ccp.inventory_movements (product_id, moved_at DESC);
CREATE INDEX idx_inventory_movements_warehouse_date ON ccp.inventory_movements (warehouse_id, moved_at DESC);
CREATE INDEX idx_inventory_movements_type ON ccp.inventory_movements (movement_type);
CREATE UNIQUE INDEX uq_inventory_movements_origin_item_type
  ON ccp.inventory_movements (origin_type, origin_item_id, movement_type)
  WHERE origin_item_id IS NOT NULL;

-- ================================================================
-- FUNCIONES GENERALES
-- ================================================================

CREATE OR REPLACE FUNCTION ccp.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ================================================================
-- TRIGGERS updated_at
-- ================================================================

CREATE TRIGGER trg_company_profile_updated_at
BEFORE UPDATE ON ccp.company_profile
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON ccp.users
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_product_categories_updated_at
BEFORE UPDATE ON ccp.product_categories
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON ccp.suppliers
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON ccp.customers
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_warehouses_updated_at
BEFORE UPDATE ON ccp.warehouses
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON ccp.products
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_purchases_updated_at
BEFORE UPDATE ON ccp.purchases
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON ccp.sales
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

CREATE TRIGGER trg_inventory_adjustments_updated_at
BEFORE UPDATE ON ccp.inventory_adjustments
FOR EACH ROW EXECUTE FUNCTION ccp.fn_set_updated_at();

-- ================================================================
-- CÁLCULO DE TOTALES (COMPRAS Y VENTAS)
-- ================================================================

CREATE OR REPLACE FUNCTION ccp.fn_recalculate_purchase_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_purchase_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_purchase_id := OLD.purchase_id;
  ELSE
    v_purchase_id := NEW.purchase_id;
  END IF;

  UPDATE ccp.purchases p
     SET subtotal = COALESCE(t.subtotal, 0),
         tax_total = COALESCE(t.tax_total, 0),
         total = COALESCE(t.total, 0),
         updated_at = NOW()
    FROM (
      SELECT pi.purchase_id,
             ROUND(SUM(pi.line_subtotal), 2) AS subtotal,
             ROUND(SUM(pi.line_tax), 2) AS tax_total,
             ROUND(SUM(pi.line_total), 2) AS total
        FROM ccp.purchase_items pi
       WHERE pi.purchase_id = v_purchase_id
       GROUP BY pi.purchase_id
    ) t
   WHERE p.id = t.purchase_id;

  IF NOT EXISTS (SELECT 1 FROM ccp.purchase_items WHERE purchase_id = v_purchase_id) THEN
    UPDATE ccp.purchases
       SET subtotal = 0,
           tax_total = 0,
           total = 0,
           updated_at = NOW()
     WHERE id = v_purchase_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalculate_purchase_totals
AFTER INSERT OR UPDATE OR DELETE ON ccp.purchase_items
FOR EACH ROW EXECUTE FUNCTION ccp.fn_recalculate_purchase_totals();

CREATE OR REPLACE FUNCTION ccp.fn_recalculate_sale_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
  ELSE
    v_sale_id := NEW.sale_id;
  END IF;

  UPDATE ccp.sales s
     SET subtotal = COALESCE(t.subtotal, 0),
         tax_total = COALESCE(t.tax_total, 0),
         total = COALESCE(t.total, 0),
         updated_at = NOW()
    FROM (
      SELECT si.sale_id,
             ROUND(SUM(si.line_subtotal), 2) AS subtotal,
             ROUND(SUM(si.line_tax), 2) AS tax_total,
             ROUND(SUM(si.line_total), 2) AS total
        FROM ccp.sale_items si
       WHERE si.sale_id = v_sale_id
       GROUP BY si.sale_id
    ) t
   WHERE s.id = t.sale_id;

  IF NOT EXISTS (SELECT 1 FROM ccp.sale_items WHERE sale_id = v_sale_id) THEN
    UPDATE ccp.sales
       SET subtotal = 0,
           tax_total = 0,
           total = 0,
           updated_at = NOW()
     WHERE id = v_sale_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalculate_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON ccp.sale_items
FOR EACH ROW EXECUTE FUNCTION ccp.fn_recalculate_sale_totals();

-- ================================================================
-- INVENTARIO: VALIDACIÓN Y APLICACIÓN DE MOVIMIENTOS
-- ================================================================

CREATE OR REPLACE FUNCTION ccp.fn_validate_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_available NUMERIC(14,3);
BEGIN
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad del movimiento debe ser mayor a cero.';
  END IF;

  IF NEW.movement_type IN ('SHRINKAGE', 'DAMAGE', 'ADJUSTMENT_OUT')
     AND COALESCE(BTRIM(NEW.reason), '') = '' THEN
    RAISE EXCEPTION 'Las salidas por merma/daño/ajuste negativo requieren motivo.';
  END IF;

  IF NEW.movement_type IN ('SALE', 'SHRINKAGE', 'DAMAGE', 'ADJUSTMENT_OUT') THEN
    SELECT b.quantity
      INTO v_available
      FROM ccp.inventory_balances b
     WHERE b.product_id = NEW.product_id
       AND b.warehouse_id = NEW.warehouse_id
     FOR UPDATE;

    v_available := COALESCE(v_available, 0);

    IF v_available < NEW.quantity THEN
      RAISE EXCEPTION
        'Stock insuficiente. Producto %, bodega %, disponible %, solicitado %',
        NEW.product_id, NEW.warehouse_id, v_available, NEW.quantity;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ccp.fn_apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance NUMERIC(14,3);
BEGIN
  -- UPDATE primero: evita el problema de INSERT ... ON CONFLICT cuando la fila
  -- ya fue bloqueada con SELECT ... FOR UPDATE por el trigger de validación.
  UPDATE ccp.inventory_balances
     SET quantity = quantity + NEW.signed_quantity,
         updated_at = NOW()
   WHERE product_id = NEW.product_id
     AND warehouse_id = NEW.warehouse_id;

  IF NOT FOUND THEN
    INSERT INTO ccp.inventory_balances (product_id, warehouse_id, quantity, updated_at)
    VALUES (NEW.product_id, NEW.warehouse_id, NEW.signed_quantity, NOW());
  END IF;

  SELECT quantity
    INTO v_new_balance
    FROM ccp.inventory_balances
   WHERE product_id = NEW.product_id
     AND warehouse_id = NEW.warehouse_id;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'No se permite stock negativo (producto %, bodega %).', NEW.product_id, NEW.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ccp.fn_block_direct_inventory_balance_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'No se permite modificar inventory_balances directamente. Use inventory_movements.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_inventory_movements_validate
BEFORE INSERT ON ccp.inventory_movements
FOR EACH ROW EXECUTE FUNCTION ccp.fn_validate_inventory_movement();

CREATE TRIGGER trg_inventory_movements_apply
AFTER INSERT ON ccp.inventory_movements
FOR EACH ROW EXECUTE FUNCTION ccp.fn_apply_inventory_movement();

CREATE TRIGGER trg_block_direct_inventory_balance_write
BEFORE INSERT OR UPDATE OR DELETE ON ccp.inventory_balances
FOR EACH ROW EXECUTE FUNCTION ccp.fn_block_direct_inventory_balance_write();

-- ================================================================
-- PUBLICACIÓN AUTOMÁTICA A INVENTARIO AL CONFIRMAR DOCUMENTOS
-- ================================================================

CREATE OR REPLACE FUNCTION ccp.fn_post_purchase_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'CONFIRMED' THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM ccp.purchase_items WHERE purchase_id = NEW.id) THEN
      RAISE EXCEPTION 'No se puede confirmar compra % sin ítems.', NEW.purchase_number;
    END IF;

    INSERT INTO ccp.inventory_movements (
      moved_at,
      warehouse_id,
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reason,
      note,
      origin_type,
      origin_id,
      origin_item_id,
      created_by
    )
    SELECT NEW.purchased_at,
           NEW.warehouse_id,
           pi.product_id,
           'PURCHASE',
           pi.quantity,
           pi.unit_cost,
           'Entrada por compra',
           COALESCE(NEW.note, 'Compra ' || NEW.purchase_number),
           'PURCHASE',
           NEW.id,
           pi.id,
           COALESCE(NEW.updated_by, NEW.created_by)
      FROM ccp.purchase_items pi
     WHERE pi.purchase_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_purchase_movements
AFTER INSERT OR UPDATE OF status ON ccp.purchases
FOR EACH ROW EXECUTE FUNCTION ccp.fn_post_purchase_movements();

CREATE OR REPLACE FUNCTION ccp.fn_post_sale_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'CONFIRMED' THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM ccp.sale_items WHERE sale_id = NEW.id) THEN
      RAISE EXCEPTION 'No se puede confirmar venta % sin ítems.', NEW.sale_number;
    END IF;

    INSERT INTO ccp.inventory_movements (
      moved_at,
      warehouse_id,
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reason,
      note,
      origin_type,
      origin_id,
      origin_item_id,
      created_by
    )
    SELECT NEW.sold_at,
           NEW.warehouse_id,
           si.product_id,
           'SALE',
           si.quantity,
           si.unit_price_excl_tax,
           'Salida por venta',
           COALESCE(NEW.note, 'Venta ' || NEW.sale_number),
           'SALE',
           NEW.id,
           si.id,
           COALESCE(NEW.updated_by, NEW.created_by)
      FROM ccp.sale_items si
     WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_sale_movements
AFTER INSERT OR UPDATE OF status ON ccp.sales
FOR EACH ROW EXECUTE FUNCTION ccp.fn_post_sale_movements();

CREATE OR REPLACE FUNCTION ccp.fn_post_adjustment_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'CONFIRMED' THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM ccp.inventory_adjustment_items WHERE adjustment_id = NEW.id) THEN
      RAISE EXCEPTION 'No se puede confirmar ajuste % sin ítems.', NEW.adjustment_number;
    END IF;

    INSERT INTO ccp.inventory_movements (
      moved_at,
      warehouse_id,
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reason,
      note,
      origin_type,
      origin_id,
      origin_item_id,
      created_by
    )
    SELECT NEW.adjusted_at,
           NEW.warehouse_id,
           ai.product_id,
           NEW.adjustment_type::TEXT::ccp.movement_type,
           ai.quantity,
           ai.unit_cost,
           NEW.reason,
           COALESCE(ai.note, NEW.note),
           'ADJUSTMENT',
           NEW.id,
           ai.id,
           COALESCE(NEW.updated_by, NEW.created_by)
      FROM ccp.inventory_adjustment_items ai
     WHERE ai.adjustment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_adjustment_movements
AFTER INSERT OR UPDATE OF status ON ccp.inventory_adjustments
FOR EACH ROW EXECUTE FUNCTION ccp.fn_post_adjustment_movements();

-- ================================================================
-- VISTAS PARA REPORTE Y KARDEX
-- ================================================================

CREATE OR REPLACE VIEW ccp.vw_current_stock AS
SELECT
  p.id AS product_id,
  p.sku,
  p.barcode,
  p.name AS product_name,
  p.image_path,
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  COALESCE(b.quantity, 0) AS current_stock,
  p.min_stock,
  (COALESCE(b.quantity, 0) <= p.min_stock) AS is_low_stock,
  p.cost_price,
  ROUND(COALESCE(b.quantity, 0) * p.cost_price, 2) AS stock_value
FROM ccp.products p
CROSS JOIN ccp.warehouses w
LEFT JOIN ccp.inventory_balances b
  ON b.product_id = p.id
 AND b.warehouse_id = w.id
WHERE p.is_active = TRUE
  AND w.is_active = TRUE;

CREATE OR REPLACE VIEW ccp.vw_low_stock AS
SELECT *
FROM ccp.vw_current_stock
WHERE is_low_stock = TRUE;

CREATE OR REPLACE VIEW ccp.vw_kardex AS
SELECT
  m.id,
  m.moved_at,
  m.product_id,
  p.sku,
  p.name AS product_name,
  p.barcode,
  m.warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  m.movement_type,
  m.direction,
  m.quantity,
  m.signed_quantity,
  m.unit_cost,
  m.reason,
  m.note,
  m.origin_type,
  m.origin_id,
  m.origin_item_id,
  u.username AS created_by_username,
  m.created_at
FROM ccp.inventory_movements m
JOIN ccp.products p ON p.id = m.product_id
JOIN ccp.warehouses w ON w.id = m.warehouse_id
LEFT JOIN ccp.users u ON u.id = m.created_by;

CREATE OR REPLACE VIEW ccp.vw_sales_daily_summary AS
SELECT
  DATE(s.sold_at) AS sale_date,
  COUNT(*) AS tickets,
  ROUND(SUM(s.subtotal), 2) AS subtotal,
  ROUND(SUM(s.tax_total), 2) AS tax_total,
  ROUND(SUM(s.total), 2) AS total
FROM ccp.sales s
WHERE s.status = 'CONFIRMED'
GROUP BY DATE(s.sold_at)
ORDER BY sale_date DESC;

-- ================================================================
-- DATOS SEMILLA
-- ================================================================

INSERT INTO ccp.roles (code, name, description)
VALUES
  ('ADMIN', 'Administrador', 'Acceso total al sistema'),
  ('SELLER', 'Vendedor', 'Operación de ventas POS y consulta de inventario'),
  ('WAREHOUSE', 'Bodega', 'Gestión de entradas, salidas y ajustes de inventario')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ccp.company_profile (id, name, nit)
VALUES (1, 'FUNDACION NUESTRO FUTURO', '902103270-7')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ccp.warehouses (code, name, description, is_default, is_active)
VALUES ('PRINCIPAL', 'Bodega Principal', 'Bodega inicial del sistema', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

COMMIT;
