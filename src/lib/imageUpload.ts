const MAX_DIMENSION_PX = 360
const MAX_COMPRESSED_BYTES = 120 * 1024

export type ImageUploadResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string }

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Could not read image file."))
      }
    }
    reader.onerror = () => reject(new Error("Could not read image file."))
    reader.readAsDataURL(file)
  })
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Unsupported or corrupted image."))
    img.src = src
  })
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
): string | null {
  const webp = canvas.toDataURL("image/webp", quality)
  if (webp.startsWith("data:image/webp")) {
    return webp
  }
  const jpeg = canvas.toDataURL("image/jpeg", quality)
  if (jpeg.startsWith("data:image/jpeg")) {
    return jpeg
  }
  return null
}

/**
 * Compresses an image data URL on an offscreen canvas to a compact
 * thumbnail or reference photo data URL suitable for local media storage.
 */
export async function compressImageDataUrl(
  rawUrl: string,
  maxDimension = MAX_DIMENSION_PX,
  maxBytes = MAX_COMPRESSED_BYTES,
): Promise<ImageUploadResult> {
  try {
    const img = await loadHtmlImage(rawUrl)
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    if (!width || !height) {
      return { ok: false, error: "Could not read image dimensions." }
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height))
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return { ok: false, error: "Image compression is unavailable here." }
    }
    ctx.drawImage(img, 0, 0, targetW, targetH)

    for (const quality of [0.8, 0.65, 0.5]) {
      const encoded = encodeCanvas(canvas, quality)
      if (encoded && encoded.length <= maxBytes) {
        return { ok: true, dataUrl: encoded }
      }
    }

    return {
      ok: false,
      error: "Image is still too large after compression. Try a smaller photo.",
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not process this image.",
    }
  }
}

/**
 * Compresses a gallery/camera image file on an offscreen canvas to a compact
 * thumbnail or reference photo data URL suitable for local media storage and JSON backups.
 */
export async function compressImageFile(
  file: File,
  maxDimension = MAX_DIMENSION_PX,
  maxBytes = MAX_COMPRESSED_BYTES,
): Promise<ImageUploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Choose an image file (JPG, PNG, or WebP)." }
  }

  try {
    const rawUrl = await readFileAsDataUrl(file)
    return compressImageDataUrl(rawUrl, maxDimension, maxBytes)
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not process this image.",
    }
  }
}
