export type ImagePresetCategory = "bakes" | "ingredients" | "packaging"

export type ImagePreset = {
  id: string
  label: string
  category: ImagePresetCategory
  bg: string
  accent: string
  ink: string
  motif:
    | "cake"
    | "cupcake"
    | "brownie"
    | "cookie"
    | "cheesecake"
    | "pastry"
    | "muffin"
    | "loaf"
    | "box-assorted"
    | "flour"
    | "butter"
    | "sugar"
    | "egg"
    | "cocoa"
    | "milk"
    | "chocolate"
    | "berries"
    | "vanilla"
    | "nuts"
    | "cake-box"
    | "cupcake-box"
    | "board"
    | "ribbon"
    | "bag"
    | "tag"
}

export const IMAGE_PRESETS: ImagePreset[] = [
  // Bakes (10)
  {
    id: "preset:chocolate-cake",
    label: "Chocolate cake",
    category: "bakes",
    bg: "#FFF1F2",
    accent: "#9F1239",
    ink: "#0F172A",
    motif: "cake",
  },
  {
    id: "preset:birthday-cake",
    label: "Celebration cake",
    category: "bakes",
    bg: "#FEF3C7",
    accent: "#E11D48",
    ink: "#0F172A",
    motif: "cake",
  },
  {
    id: "preset:cupcake",
    label: "Cupcakes",
    category: "bakes",
    bg: "#FFF1F2",
    accent: "#FB7185",
    ink: "#0F172A",
    motif: "cupcake",
  },
  {
    id: "preset:brownie",
    label: "Brownies",
    category: "bakes",
    bg: "#F3E8FF",
    accent: "#78350F",
    ink: "#0F172A",
    motif: "brownie",
  },
  {
    id: "preset:cookies",
    label: "Cookies",
    category: "bakes",
    bg: "#FEF3C7",
    accent: "#D97706",
    ink: "#0F172A",
    motif: "cookie",
  },
  {
    id: "preset:cheesecake",
    label: "Cheesecake",
    category: "bakes",
    bg: "#ECFDF5",
    accent: "#F59E0B",
    ink: "#0F172A",
    motif: "cheesecake",
  },
  {
    id: "preset:pastry",
    label: "Pastry",
    category: "bakes",
    bg: "#EFF6FF",
    accent: "#F59E0B",
    ink: "#0F172A",
    motif: "pastry",
  },
  {
    id: "preset:muffin",
    label: "Muffins",
    category: "bakes",
    bg: "#ECFDF5",
    accent: "#10B981",
    ink: "#0F172A",
    motif: "muffin",
  },
  {
    id: "preset:loaf-cake",
    label: "Loaf cake",
    category: "bakes",
    bg: "#FEF3C7",
    accent: "#B45309",
    ink: "#0F172A",
    motif: "loaf",
  },
  {
    id: "preset:dessert-box",
    label: "Treat box",
    category: "bakes",
    bg: "#EFF6FF",
    accent: "#E11D48",
    ink: "#0F172A",
    motif: "box-assorted",
  },

  // Ingredients (10)
  {
    id: "preset:flour",
    label: "Flour",
    category: "ingredients",
    bg: "#EFF6FF",
    accent: "#3B82F6",
    ink: "#0F172A",
    motif: "flour",
  },
  {
    id: "preset:butter",
    label: "Butter",
    category: "ingredients",
    bg: "#FEF3C7",
    accent: "#F59E0B",
    ink: "#0F172A",
    motif: "butter",
  },
  {
    id: "preset:sugar",
    label: "Sugar",
    category: "ingredients",
    bg: "#F1F5F9",
    accent: "#60A5FA",
    ink: "#0F172A",
    motif: "sugar",
  },
  {
    id: "preset:eggs",
    label: "Eggs",
    category: "ingredients",
    bg: "#FEF3C7",
    accent: "#FBBF24",
    ink: "#0F172A",
    motif: "egg",
  },
  {
    id: "preset:cocoa",
    label: "Cocoa",
    category: "ingredients",
    bg: "#FFF1F2",
    accent: "#78350F",
    ink: "#0F172A",
    motif: "cocoa",
  },
  {
    id: "preset:milk",
    label: "Milk & cream",
    category: "ingredients",
    bg: "#EFF6FF",
    accent: "#60A5FA",
    ink: "#0F172A",
    motif: "milk",
  },
  {
    id: "preset:chocolate",
    label: "Chocolate",
    category: "ingredients",
    bg: "#F3E8FF",
    accent: "#78350F",
    ink: "#0F172A",
    motif: "chocolate",
  },
  {
    id: "preset:berries",
    label: "Berries & fruit",
    category: "ingredients",
    bg: "#FFF1F2",
    accent: "#E11D48",
    ink: "#0F172A",
    motif: "berries",
  },
  {
    id: "preset:vanilla",
    label: "Essence",
    category: "ingredients",
    bg: "#ECFDF5",
    accent: "#059669",
    ink: "#0F172A",
    motif: "vanilla",
  },
  {
    id: "preset:nuts",
    label: "Nuts & toppings",
    category: "ingredients",
    bg: "#FEF3C7",
    accent: "#B45309",
    ink: "#0F172A",
    motif: "nuts",
  },

  // Packaging (6)
  {
    id: "preset:cake-box",
    label: "Cake box",
    category: "packaging",
    bg: "#FFF1F2",
    accent: "#E11D48",
    ink: "#0F172A",
    motif: "cake-box",
  },
  {
    id: "preset:cupcake-box",
    label: "Cupcake box",
    category: "packaging",
    bg: "#EFF6FF",
    accent: "#3B82F6",
    ink: "#0F172A",
    motif: "cupcake-box",
  },
  {
    id: "preset:cake-board",
    label: "Cake board",
    category: "packaging",
    bg: "#FEF3C7",
    accent: "#D97706",
    ink: "#0F172A",
    motif: "board",
  },
  {
    id: "preset:ribbon",
    label: "Ribbon",
    category: "packaging",
    bg: "#FFF1F2",
    accent: "#FB7185",
    ink: "#0F172A",
    motif: "ribbon",
  },
  {
    id: "preset:gift-bag",
    label: "Gift bag",
    category: "packaging",
    bg: "#ECFDF5",
    accent: "#10B981",
    ink: "#0F172A",
    motif: "bag",
  },
  {
    id: "preset:tag",
    label: "Sticker & tag",
    category: "packaging",
    bg: "#F1F5F9",
    accent: "#64748B",
    ink: "#0F172A",
    motif: "tag",
  },
]

const PRESET_MAP = new Map(IMAGE_PRESETS.map((preset) => [preset.id, preset]))

export function getImagePreset(value?: string): ImagePreset | undefined {
  if (!value) return undefined
  return PRESET_MAP.get(value)
}

export function getImagePresetsByCategory(
  category: ImagePresetCategory,
): ImagePreset[] {
  return IMAGE_PRESETS.filter((preset) => preset.category === category)
}

export function isDataImageUrl(value?: string): boolean {
  return (
    typeof value === "string" &&
    /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(
      value.trim(),
    )
  )
}

export function isValidImageValue(value: unknown): value is string {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  return Boolean(PRESET_MAP.has(trimmed) || isDataImageUrl(trimmed))
}
