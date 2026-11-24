import { describe, expect, it } from "vitest"
import { BUILT_IN_EXPENSE_CATEGORIES } from "../lib/expenses"
import { migrateState, reducer } from "../state/AppState"
import { createEmptyAppData } from "./defaults"
import {
  createStarterData,
  getInitialAppData,
  resolveStarterMode,
} from "./starterData"

describe("Phase 11 starter and empty workspace data", () => {
  it("creates a completely empty workspace with built-in expense categories", () => {
    const empty = createEmptyAppData()
    expect(empty.customers).toEqual([])
    expect(empty.products).toEqual([])
    expect(empty.recipes).toEqual([])
    expect(empty.orders).toEqual([])
    expect(empty.inventory).toEqual([])
    expect(empty.purchases).toEqual([])
    expect(empty.expenses).toEqual([])
    expect(empty.expenseCategories).toEqual(BUILT_IN_EXPENSE_CATEGORIES)
  })

  it("creates a minimal 1-item starter slice with only referenced inventory", () => {
    const starter = createStarterData()
    expect(starter.customers).toHaveLength(1)
    expect(starter.products).toHaveLength(1)
    expect(starter.products[0].variants).toHaveLength(1)
    expect(starter.recipes).toHaveLength(1)
    expect(starter.orders).toHaveLength(1)

    const recipe = starter.recipes[0]
    const referencedIds = new Set([
      ...recipe.ingredients.map((item) => item.inventoryId),
      ...recipe.packaging.map((item) => item.inventoryId),
    ])
    expect(starter.inventory.map((item) => item.inventoryId).sort()).toEqual(
      Array.from(referencedIds).sort(),
    )
    expect(
      starter.inventory.some((item) => item.category === "finished"),
    ).toBe(false)
  })

  it("does not inject mock inventory when migrating an empty workspace", () => {
    const migrated = migrateState(createEmptyAppData())
    expect(migrated.inventory).toEqual([])
    expect(migrated.recipes).toEqual([])
    expect(migrated.orders).toEqual([])
    expect(migrated.customers).toEqual([])
    expect(migrated.products).toEqual([])
  })

  it("resolves VITE_STARTER_MODE cleanly between minimal and empty", () => {
    expect(resolveStarterMode(undefined)).toBe("minimal")
    expect(resolveStarterMode("")).toBe("minimal")
    expect(resolveStarterMode("minimal")).toBe("minimal")
    expect(resolveStarterMode("EMPTY")).toBe("empty")
    expect(resolveStarterMode(" empty ")).toBe("empty")
    expect(getInitialAppData("empty").orders).toEqual([])
    expect(getInitialAppData("minimal").orders).toHaveLength(1)
  })

  it("supports CLEAR_WORKSPACE and LOAD_STARTER_SAMPLE reducer actions", () => {
    const seeded = migrateState(createStarterData())
    const cleared = reducer(seeded, { type: "CLEAR_WORKSPACE" })
    expect(cleared.customers).toEqual([])
    expect(cleared.products).toEqual([])
    expect(cleared.recipes).toEqual([])
    expect(cleared.orders).toEqual([])
    expect(cleared.inventory).toEqual([])

    const reloaded = reducer(cleared, { type: "LOAD_STARTER_SAMPLE" })
    expect(reloaded.customers).toHaveLength(1)
    expect(reloaded.products).toHaveLength(1)
    expect(reloaded.recipes).toHaveLength(1)
    expect(reloaded.orders).toHaveLength(1)
    expect(reloaded.inventory).toHaveLength(6)
  })
})
