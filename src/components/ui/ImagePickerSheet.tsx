import { useRef, useState, type ChangeEvent } from "react"
import { Check, ImagePlus, Trash2, Upload } from "lucide-react"
import {
  getImagePresetsByCategory,
  type ImagePresetCategory,
} from "../../lib/imageLibrary"
import { compressImageFile } from "../../lib/imageUpload"
import Button from "./Button"
import ItemThumbnail from "./ItemThumbnail"
import { TabView } from "./MotionPrimitives"
import SegmentedControl from "./SegmentedControl"
import Sheet from "./Sheet"

type ImagePickerFieldProps = {
  label?: string
  value?: string
  defaultCategory?: ImagePresetCategory
  onChange: (value: string | undefined) => void
}

/**
 * Compact inline image selector used inside Product, Recipe, and Inventory
 * editor sheets.
 */
export function ImagePickerField({
  label = "Item photo",
  value,
  defaultCategory = "bakes",
  onChange,
}: ImagePickerFieldProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-control border border-warm-border bg-ivory/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <ItemThumbnail
            image={value}
            alt={label}
            size="sm"
            showPlaceholder
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-cocoa">{label}</p>
            <p className="text-[11px] text-muted">
              {value ? "Shown on cards & lists" : "Library icon or gallery photo"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {value ? (
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => onChange(undefined)}
              className="inline-flex size-8 items-center justify-center rounded-full border border-warm-border bg-white text-muted transition hover:text-error active:scale-button"
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          ) : null}
          <Button
            size="compact"
            variant="secondary"
            leadingIcon={<ImagePlus aria-hidden="true" size={14} />}
            onClick={() => setSheetOpen(true)}
          >
            {value ? "Change" : "Choose"}
          </Button>
        </div>
      </div>

      <ImagePickerSheet
        open={sheetOpen}
        value={value}
        defaultCategory={defaultCategory}
        onSelect={(next) => {
          onChange(next)
          setSheetOpen(false)
        }}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}

type ImagePickerSheetProps = {
  open: boolean
  value?: string
  defaultCategory?: ImagePresetCategory
  onSelect: (value: string | undefined) => void
  onClose: () => void
}

export function ImagePickerSheet({
  open,
  value,
  defaultCategory = "bakes",
  onSelect,
  onClose,
}: ImagePickerSheetProps) {
  const [mode, setMode] = useState<"library" | "gallery">("library")
  const [category, setCategory] =
    useState<ImagePresetCategory>(defaultCategory)
  const [uploadError, setUploadError] = useState("")
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const presets = getImagePresetsByCategory(category)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploadError("")
    setCompressing(true)
    const result = await compressImageFile(file)
    setCompressing(false)
    if (!result.ok) {
      setUploadError(result.error)
      return
    }
    onSelect(result.dataUrl)
  }

  return (
    <Sheet
      open={open}
      title="Choose image"
      subtitle="Pick a food icon or upload from your phone gallery"
      onClose={onClose}
    >
      <div className="space-y-4">
        <SegmentedControl
          label="Image source"
          value={mode}
          onChange={(next) => setMode(next as "library" | "gallery")}
          segments={[
            { value: "library", label: "Library" },
            { value: "gallery", label: "Gallery" },
          ]}
        />

        <TabView viewKey={mode}>
          {mode === "library" ? (
            <div className="space-y-3">
              <SegmentedControl
                label="Library category"
                value={category}
                onChange={(next) => setCategory(next as ImagePresetCategory)}
                segments={[
                  { value: "bakes", label: "Bakes" },
                  { value: "savories", label: "Savories" },
                  { value: "ingredients", label: "Ingredients" },
                  { value: "packaging", label: "Packaging" },
                ]}
              />

              <div className="grid grid-cols-3 gap-2.5">
                {presets.map((preset) => {
                  const selected = value === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelect(preset.id)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-card border p-2.5 text-center transition active:scale-button ${
                        selected
                          ? "border-sage bg-sage-soft/70 ring-2 ring-sage/25"
                          : "border-warm-border bg-white hover:border-sage-border"
                      }`}
                    >
                      {selected ? (
                        <span className="absolute right-1.5 top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-sage text-white">
                          <Check aria-hidden="true" size={10} />
                        </span>
                      ) : null}
                      <ItemThumbnail
                        image={preset.id}
                        alt={preset.label}
                        size="md"
                      />
                      <span className="line-clamp-1 text-[11px] font-medium text-cocoa">
                        {preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
              <button
                type="button"
                disabled={compressing}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-sage-border bg-ivory/70 px-5 py-8 text-center transition hover:bg-sage-soft/50 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-white text-sage-dark shadow-subtle">
                  <Upload aria-hidden="true" size={20} />
                </span>
                <span className="text-sm font-semibold text-cocoa">
                  {compressing
                    ? "Compressing photo..."
                    : "Tap to choose from gallery or camera"}
                </span>
                <span className="text-xs text-muted">
                  Photos are resized automatically so backups stay fast.
                </span>
              </button>

              {uploadError ? (
                <p role="alert" className="text-xs font-medium text-error">
                  {uploadError}
                </p>
              ) : null}
            </div>
          )}
        </TabView>
      </div>
    </Sheet>
  )
}
