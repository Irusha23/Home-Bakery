import type { SqlMigration } from "./0001_initial_schema"

export const migration0002OrderReferencePhoto: SqlMigration = {
  version: 2,
  name: "0002_order_reference_photo",
  sql: `ALTER TABLE orders ADD COLUMN reference_photo TEXT;`,
}
