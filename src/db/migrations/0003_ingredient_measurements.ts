import type { SqlMigration } from "./0001_initial_schema"

export const migration0003IngredientMeasurements: SqlMigration = {
  version: 3,
  name: "0003_ingredient_measurements",
  sql: `
ALTER TABLE inventory_items
  ADD COLUMN grams_per_tsp REAL CHECK (grams_per_tsp IS NULL OR grams_per_tsp > 0);

ALTER TABLE inventory_items
  ADD COLUMN ml_per_tsp REAL CHECK (ml_per_tsp IS NULL OR ml_per_tsp > 0);

ALTER TABLE inventory_items
  ADD COLUMN track_stock INTEGER CHECK (track_stock IS NULL OR track_stock IN (0, 1));

UPDATE inventory_items
SET track_stock = 1
WHERE track_stock IS NULL
  AND (
    category = 'finished'
    OR physical > 0
    OR COALESCE(low_stock_threshold, 0) > 0
  );

CREATE TABLE purchases_v3 (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  purchased_quantity REAL NOT NULL CHECK (purchased_quantity > 0),
  purchased_unit TEXT NOT NULL CHECK (purchased_unit IN ('g', 'kg', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'unit')),
  usable_quantity REAL NOT NULL CHECK (usable_quantity > 0),
  usable_unit TEXT NOT NULL CHECK (usable_unit IN ('g', 'kg', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'unit')),
  usable_base_quantity REAL NOT NULL CHECK (usable_base_quantity > 0),
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO purchases_v3 (
  id, inventory_id, purchased_quantity, purchased_unit, usable_quantity,
  usable_unit, usable_base_quantity, total_price, date, note, created_at, sort_order
)
SELECT
  id, inventory_id, purchased_quantity, purchased_unit, usable_quantity,
  usable_unit, usable_base_quantity, total_price, date, note, created_at, sort_order
FROM purchases;

DROP TABLE purchases;
ALTER TABLE purchases_v3 RENAME TO purchases;
`,
}
