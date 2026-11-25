import type { SqlMigration } from "./0001_initial_schema"

export const migration0004RecipeSellingPrice: SqlMigration = {
  version: 4,
  name: "0004_recipe_selling_price",
  sql: `
ALTER TABLE recipes
  ADD COLUMN selling_price INTEGER CHECK (selling_price IS NULL OR selling_price >= 0);

ALTER TABLE recipes
  ADD COLUMN pricing_json TEXT;
`,
}
