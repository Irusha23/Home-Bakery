import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Capacitor } from "@capacitor/core"
import {
  Camera as NativeCamera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera"
import { Camera, Check, ImagePlus, Trash2, Upload } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import {
  getImagePresetsByCategory,
  type ImagePresetCategory,
} from "../../lib/imageLibrary"
import { compressImageDataUrl, compressImageFile } from "../../lib/imageUpload"
import { defaultMediaStore } from "../../lib/mediaStore"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_PANEL,
  staggerDelay,
} from "../../lib/motion"
import Button from "./Button"
import ItemThumbnail from "./ItemThumbnail"
import { TabView } from "./MotionPrimitives"
import SegmentedControl from "./SegmentedControl"
import Sheet from "./Sheet"

type ImagePickerFieldProps = {
  label?: string
  value?: string
  defaultCategory?: ImagePresetCategory
  galleryOnly?: boolean
  photoPreset?: "thumbnail" | "reference"
  onChange: (value: string | undefined) => void
}

/**
 * Compact inline image selector used inside Product, Recipe, Inventory, and
 * Order flows.
 */
export function ImagePickerField({
  label = "Item photo",
  value,
  defaultCategory = "bakes",
  galleryOnly = false,
  photoPreset = "thumbnail",
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
              {value
                ? galleryOnly
                  ? "Attached to this order"
                  : "Shown on cards & lists"
                : galleryOnly
                  ? "Cake design, sketch, or WhatsApp photo"
                  : "Library icon or gallery photo"}
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
        galleryOnly={galleryOnly}
        photoPreset={photoPreset}
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
  galleryOnly?: boolean
  photoPreset?: "thumbnail" | "reference"
  onSelect: (value: string | undefined) => void
  onClose: () => void
}

export function ImagePickerSheet({
  open,
  value,
  defaultCategory = "bakes",
  galleryOnly = false,
  photoPreset = "thumbnail",
  onSelect,
  onClose,
}: ImagePickerSheetProps) {
  const reducedMotion = useReducedMotion()
  const [mode, setMode] = useState<"library" | "gallery">(
    galleryOnly ? "gallery" : "library",
  )
  const [category, setCategory] =
    useState<ImagePresetCategory>(defaultCategory)
  const [uploadError, setUploadError] = useState("")
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setMode(galleryOnly ? "gallery" : "library")
      setUploadError("")
    }
  }, [galleryOnly, open])

  const presets = getImagePresetsByCategory(category)

  const maxDimension = photoPreset === "reference" ? 720 : 360
  const maxBytes = photoPreset === "reference" ? 240 * 1024 : 120 * 1024

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploadError("")
    setCompressing(true)
    const result = await compressImageFile(file, maxDimension, maxBytes)
    if (!result.ok) {
      setCompressing(false)
      setUploadError(result.error)
      return
    }
    const storedRef = await defaultMediaStore.saveMedia(result.dataUrl)
    setCompressing(false)
    onSelect(storedRef)
  }

  const handleNativePick = async (source: CameraSource) => {
    if (compressing) return
    setUploadError("")
    setCompressing(true)
    try {
      const photo = await NativeCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source,
      })
      if (!photo.dataUrl) {
        setCompressing(false)
        setUploadError("No photo was returned.")
        return
      }
      const result = await compressImageDataUrl(
        photo.dataUrl,
        maxDimension,
        maxBytes,
      )
      if (!result.ok) {
        setCompressing(false)
        setUploadError(result.error)
        return
      }
      const storedRef = await defaultMediaStore.saveMedia(result.dataUrl)
      setCompressing(false)
      onSelect(storedRef)
    } catch (caught) {
      setCompressing(false)
      const message =
        caught instanceof Error ? caught.message.toLowerCase() : ""
      if (message.includes("cancel")) return
      setUploadError(
        caught instanceof Error ? caught.message : "Could not load photo.",
      )
    }
  }

  return (
    <Sheet
      open={open}
      title={galleryOnly ? "Attach reference photo" : "Choose image"}
      subtitle={
        galleryOnly
          ? "Take a photo or choose from your phone gallery"
          : "Pick a food icon or upload from your phone gallery"
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {!galleryOnly ? (
          <SegmentedControl
            label="Image source"
            value={mode}
            onChange={(next) => setMode(next as "library" | "gallery")}
            segments={[
              { value: "library", label: "Library" },
              { value: "gallery", label: "Gallery" },
            ]}
          />
        ) : null}

        <TabView viewKey={mode}>
          {mode === "library" && !galleryOnly ? (
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
                {presets.map((preset, index) => {
                  const selected = value === preset.id
                  return (
                    <motion.button
                      key={`${category}-${preset.id}`}
                      type="button"
                      initial={
                        reducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 6, scale: 0.96 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
                      transition={
                        reducedMotion
                          ? REDUCED_MOTION_TRANSITION
                          : { ...SPRING_PANEL, delay: staggerDelay(index) }
                      }
                      onClick={() => onSelect(preset.id)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-card border p-2.5 text-center transition-colors duration-200 ${
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
                    </motion.button>
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
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="sr-only"
              />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={compressing}
                  onClick={() => {
                    if (Capacitor.isNativePlatform()) {
                      void handleNativePick(CameraSource.Photos)
                    } else {
                      fileInputRef.current?.click()
                    }
                  }}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-sage-border bg-ivory/70 px-4 py-6 text-center transition hover:bg-sage-soft/50 active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-white text-sage-dark shadow-subtle">
                    <Upload aria-hidden="true" size={19} />
                  </span>
                  <span className="text-sm font-semibold text-cocoa">
                    {compressing ? "Saving photo..." : "Choose from gallery"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={compressing}
                  onClick={() => {
                    if (Capacitor.isNativePlatform()) {
                      void handleNativePick(CameraSource.Camera)
                    } else {
                      cameraInputRef.current?.click()
                    }
                  }}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-sage-border bg-ivory/70 px-4 py-6 text-center transition hover:bg-sage-soft/50 active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-white text-sage-dark shadow-subtle">
                    <Camera aria-hidden="true" size={19} />
                  </span>
                  <span className="text-sm font-semibold text-cocoa">
                    {compressing ? "Saving photo..." : "Take photo"}
                  </span>
                </button>
              </div>
              <p className="text-center text-xs text-muted">
                Photos are resized and stored locally on this device so backups stay fast.
              </p>

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
