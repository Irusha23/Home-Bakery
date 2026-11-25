export type SqlMigration = {
  version: number
  name: string
  sql: string
}

export const migration0001InitialSchema: SqlMigration = {
  version: 1,
  name: "0001_initial_schema",
  sql: `
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  default_labour_rate_per_hour INTEGER NOT NULL CHECK (default_labour_rate_per_hour >= 0),
  default_pricing_mode TEXT NOT NULL CHECK (default_pricing_mode IN ('margin', 'markup')),
  default_margin_percent REAL NOT NULL CHECK (default_margin_percent >= 0 AND default_margin_percent < 100),
  default_markup_percent REAL NOT NULL CHECK (default_markup_percent >= 0),
  price_rounding_step INTEGER NOT NULL CHECK (price_rounding_step IN (1, 50, 100)),
  default_low_stock_threshold REAL NOT NULL CHECK (default_low_stock_threshold >= 0),
  backup_reminder_dismissed_at TEXT,
  backup_reminder_snoozed_until TEXT,
  last_backup_at TEXT
);

CREATE TABLE IF NOT EXISTS budget_plans (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  monthly_sales_target INTEGER CHECK (monthly_sales_target IS NULL OR monthly_sales_target >= 0),
  monthly_profit_target INTEGER CHECK (monthly_profit_target IS NULL OR monthly_profit_target >= 0),
  ingredient_spend_limit INTEGER CHECK (ingredient_spend_limit IS NULL OR ingredient_spend_limit >= 0),
  category_limits_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  read_ids_json TEXT NOT NULL DEFAULT '[]',
  dismissed_ids_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phone TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_items (
  inventory_id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  image TEXT,
  physical REAL NOT NULL CHECK (physical >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'unit')),
  category TEXT NOT NULL CHECK (category IN ('ingredient', 'packaging', 'finished')),
  unbatched_legacy_quantity REAL CHECK (unbatched_legacy_quantity IS NULL OR unbatched_legacy_quantity >= 0),
  low_stock_threshold REAL CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  average_unit_cost REAL CHECK (average_unit_cost IS NULL OR average_unit_cost >= 0),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  image TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  unit_label TEXT NOT NULL,
  finished_inventory_id TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  image TEXT,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  yield REAL NOT NULL CHECK (yield > 0),
  yield_label TEXT NOT NULL,
  expected_output_json TEXT,
  preparation_minutes INTEGER NOT NULL CHECK (preparation_minutes >= 0),
  ingredients_json TEXT NOT NULL,
  packaging_json TEXT NOT NULL,
  instructions_json TEXT NOT NULL,
  estimated_cost REAL NOT NULL CHECK (estimated_cost >= 0),
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  notes TEXT,
  history_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  is_quick_order INTEGER NOT NULL DEFAULT 0 CHECK (is_quick_order IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Confirmed', 'In Progress', 'Completed', 'Cancelled')),
  preparation_status TEXT NOT NULL CHECK (preparation_status IN ('Not started', 'Awaiting preparation', 'In progress', 'Ready', 'Completed', 'Cancelled')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Unpaid', 'Part paid', 'Paid', 'Refunded')),
  collection_date TEXT NOT NULL,
  collection_time TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  agreed_price INTEGER NOT NULL CHECK (agreed_price >= 0),
  cost_snapshot_json TEXT NOT NULL,
  reservations_json TEXT NOT NULL,
  shortages_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  collected_at TEXT,
  cancellation_fee INTEGER CHECK (cancellation_fee IS NULL OR cancellation_fee >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  recipe_id TEXT,
  recipe_snapshot_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  purchased_quantity REAL NOT NULL CHECK (purchased_quantity > 0),
  purchased_unit TEXT NOT NULL CHECK (purchased_unit IN ('g', 'kg', 'ml', 'L', 'unit')),
  usable_quantity REAL NOT NULL CHECK (usable_quantity > 0),
  usable_unit TEXT NOT NULL CHECK (usable_unit IN ('g', 'kg', 'ml', 'L', 'unit')),
  usable_base_quantity REAL NOT NULL CHECK (usable_base_quantity > 0),
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'Opening balance',
    'Purchase',
    'Correction',
    'Spoilage',
    'Damage',
    'Other',
    'Preparation consumption',
    'Production',
    'Finished stock sale',
    'Finished stock write-off'
  )),
  quantity_delta REAL NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'unit')),
  balance_after REAL NOT NULL CHECK (balance_after >= 0),
  date TEXT NOT NULL,
  reason TEXT NOT NULL,
  purchase_id TEXT,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preparation_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_line_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Awaiting preparation', 'In progress', 'Ready', 'Cancelled')),
  recipe_snapshot_json TEXT NOT NULL,
  planned_quantity REAL NOT NULL CHECK (planned_quantity > 0),
  actual_usage_json TEXT NOT NULL,
  completed_steps_json TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  actual_cost INTEGER CHECK (actual_cost IS NULL OR actual_cost >= 0),
  updated_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (order_id, order_line_id)
);

CREATE TABLE IF NOT EXISTS extra_stock_plans (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  recipe_snapshot_json TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  best_before TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS extra_stock_preparations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  finished_inventory_id TEXT NOT NULL,
  recipe_snapshot_json TEXT NOT NULL,
  planned_batches REAL NOT NULL CHECK (planned_batches > 0),
  status TEXT NOT NULL CHECK (status IN ('Awaiting preparation', 'In progress', 'Ready', 'Cancelled')),
  actual_usage_json TEXT NOT NULL,
  completed_steps_json TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  actual_cost INTEGER CHECK (actual_cost IS NULL OR actual_cost >= 0),
  updated_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finished_stock_batches (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('production', 'legacy-opening')),
  inventory_id TEXT NOT NULL,
  remaining_quantity REAL NOT NULL CHECK (remaining_quantity >= 0),
  payload_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finished_stock_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('sale', 'write-off')),
  batch_id TEXT NOT NULL REFERENCES finished_stock_batches(id) ON DELETE RESTRICT,
  inventory_id TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  occurred_at TEXT NOT NULL,
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  total_cost REAL NOT NULL CHECK (total_cost >= 0),
  payload_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  source TEXT NOT NULL CHECK (source IN ('built-in', 'custom')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount > 0),
  paid_date TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  note TEXT,
  attribution_type TEXT NOT NULL CHECK (attribution_type IN ('direct', 'shared')),
  attribution_order_id TEXT,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_allocation_versions (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL,
  reason TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (expense_id, version)
);

CREATE TABLE IF NOT EXISTS expense_allocations (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES expense_allocation_versions(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shopping_selections (
  inventory_id TEXT PRIMARY KEY,
  quantity REAL NOT NULL CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS shopping_trips (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  total_spent INTEGER CHECK (total_spent IS NULL OR total_spent >= 0),
  expense_id TEXT,
  items_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipes_product_variant ON recipes (product_id, variant_id, archived);
CREATE INDEX IF NOT EXISTS idx_orders_status_collection ON orders (status, collection_date, collection_time);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines (order_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments (date);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_purchases_inventory_date ON purchases (inventory_id, date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_date ON inventory_movements (inventory_id, date);
CREATE INDEX IF NOT EXISTS idx_finished_batches_inventory ON finished_stock_batches (inventory_id, remaining_quantity);
CREATE INDEX IF NOT EXISTS idx_finished_tx_batch ON finished_stock_transactions (batch_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_date ON expenses (paid_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses (category_id);
`,
}
