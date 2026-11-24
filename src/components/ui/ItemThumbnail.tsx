import { Image as ImageIcon } from "lucide-react"
import {
  getImagePreset,
  isDataImageUrl,
  type ImagePreset,
} from "../../lib/imageLibrary"

type ThumbnailSize = "xs" | "sm" | "md" | "lg"

type ItemThumbnailProps = {
  image?: string
  alt: string
  size?: ThumbnailSize
  className?: string
  showPlaceholder?: boolean
}

const SIZE_CLASSES: Record<ThumbnailSize, string> = {
  xs: "size-8 rounded-lg",
  sm: "size-11 rounded-xl",
  md: "size-14 rounded-2xl",
  lg: "size-20 rounded-2xl",
}

function PresetArtwork({ preset }: { preset: ImagePreset }) {
  const { bg, accent, ink, motif } = preset
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="h-full w-full"
    >
      <rect width="64" height="64" rx="14" fill={bg} />
      {motif === "cake" || motif === "cheesecake" ? (
        <>
          <rect
            x="14"
            y="30"
            width="36"
            height="20"
            rx="5"
            fill={accent}
            stroke={ink}
            strokeWidth="2.4"
          />
          <path
            d="M14 33c0-3 3-5 6-5h24c3 0 6 2 6 5v2c-4 3-8 0-12 2-4-2-8 2-12 0-4 2-8-1-12-2v-2Z"
            fill="#FFFFFF"
            stroke={ink}
            strokeWidth="2"
          />
          <circle cx="32" cy="21" r="4" fill="#E11D48" stroke={ink} strokeWidth="2" />
        </>
      ) : motif === "cupcake" || motif === "muffin" ? (
        <>
          <path
            d="M20 35h24l-3 15c-.4 1.4-1.6 2-3 2H26c-1.4 0-2.6-.6-3-2l-3-15Z"
            fill="#FBBF24"
            stroke={ink}
            strokeWidth="2.4"
          />
          <path
            d="M17 34c0-5 4-8 8-8 1-5 5-8 7-8 4 0 7 3 8 8 4 0 7 3 7 8 0 2.5-2 4-4.5 4h-21c-2.5 0-4.5-1.5-4.5-4Z"
            fill={accent}
            stroke={ink}
            strokeWidth="2.4"
          />
          <circle cx="32" cy="15" r="3.5" fill="#E11D48" stroke={ink} strokeWidth="2" />
        </>
      ) : motif === "brownie" || motif === "chocolate" || motif === "loaf" ? (
        <>
          <rect
            x="14"
            y="24"
            width="36"
            height="22"
            rx="6"
            fill={accent}
            stroke={ink}
            strokeWidth="2.4"
          />
          <path d="M26 24v22M38 24v22M14 35h36" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" />
        </>
      ) : motif === "cookie" ? (
        <>
          <circle cx="28" cy="36" r="13" fill={accent} stroke={ink} strokeWidth="2.4" />
          <circle cx="40" cy="27" r="10" fill="#FBBF24" stroke={ink} strokeWidth="2.4" />
          <circle cx="24" cy="34" r="2" fill={ink} />
          <circle cx="31" cy="40" r="2" fill={ink} />
          <circle cx="41" cy="26" r="1.8" fill={ink} />
        </>
      ) : motif === "pastry" ? (
        <>
          <path
            d="M14 40c2-11 10-18 18-18s16 7 18 18c-5 4-11 6-18 6s-13-2-18-6Z"
            fill={accent}
            stroke={ink}
            strokeWidth="2.4"
          />
          <path d="M24 25l3 18M40 25l-3 18" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : motif === "flour" || motif === "sugar" || motif === "cocoa" ? (
        <>
          <path
            d="M20 22h24l3 26c.2 2-1.4 4-3.5 4h-23c-2.1 0-3.7-2-3.5-4l3-26Z"
            fill="#FFFFFF"
            stroke={ink}
            strokeWidth="2.4"
          />
          <rect x="23" y="15" width="18" height="7" rx="3" fill={accent} stroke={ink} strokeWidth="2.2" />
          <circle cx="32" cy="38" r="5" fill={accent} />
        </>
      ) : motif === "butter" ? (
        <>
          <rect
            x="14"
            y="28"
            width="36"
            height="18"
            rx="4"
            fill={accent}
            stroke={ink}
            strokeWidth="2.4"
          />
          <path d="M22 28l6-7h18l-6 7" fill="#FDE68A" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" />
        </>
      ) : motif === "egg" ? (
        <>
          <ellipse cx="27" cy="35" rx="9" ry="12" fill="#FEF3C7" stroke={ink} strokeWidth="2.4" />
          <ellipse cx="38" cy="37" rx="9" ry="11" fill="#FDE68A" stroke={ink} strokeWidth="2.4" />
        </>
      ) : motif === "milk" || motif === "vanilla" ? (
        <>
          <rect
            x="22"
            y="22"
            width="20"
            height="28"
            rx="5"
            fill="#FFFFFF"
            stroke={ink}
            strokeWidth="2.4"
          />
          <rect x="26" y="14" width="12" height="8" rx="2.5" fill={accent} stroke={ink} strokeWidth="2.2" />
          <rect x="25" y="32" width="14" height="10" rx="2" fill={accent} />
        </>
      ) : motif === "berries" ? (
        <>
          <circle cx="26" cy="38" r="8" fill={accent} stroke={ink} strokeWidth="2.4" />
          <circle cx="38" cy="38" r="8" fill="#FB7185" stroke={ink} strokeWidth="2.4" />
          <circle cx="32" cy="27" r="8" fill={accent} stroke={ink} strokeWidth="2.4" />
          <path d="M32 16l3 4-3 2-3-2 3-4Z" fill="#10B981" stroke={ink} strokeWidth="1.8" />
        </>
      ) : motif === "nuts" ? (
        <>
          <ellipse cx="26" cy="36" rx="7" ry="10" transform="rotate(-20 26 36)" fill={accent} stroke={ink} strokeWidth="2.4" />
          <ellipse cx="38" cy="34" rx="7" ry="10" transform="rotate(20 38 34)" fill="#FBBF24" stroke={ink} strokeWidth="2.4" />
        </>
      ) : motif === "cake-box" || motif === "cupcake-box" || motif === "box-assorted" ? (
        <>
          <rect x="16" y="26" width="32" height="22" rx="5" fill="#FFFFFF" stroke={ink} strokeWidth="2.4" />
          <rect x="13" y="20" width="38" height="9" rx="4" fill={accent} stroke={ink} strokeWidth="2.4" />
          <rect x="29" y="20" width="6" height="28" fill="#E11D48" />
        </>
      ) : motif === "board" ? (
        <>
          <ellipse cx="32" cy="34" rx="20" ry="11" fill={accent} stroke={ink} strokeWidth="2.4" />
          <ellipse cx="32" cy="33" rx="13" ry="6.5" fill="#FEF3C7" />
        </>
      ) : motif === "ribbon" ? (
        <>
          <circle cx="32" cy="34" r="13" fill={accent} stroke={ink} strokeWidth="2.4" />
          <circle cx="32" cy="34" r="5" fill="#FFFFFF" stroke={ink} strokeWidth="2.2" />
          <path d="M24 44l-4 8M40 44l4 8" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        </>
      ) : motif === "bag" ? (
        <>
          <path d="M24 23c0-5 16-5 16 0" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="18" y="23" width="28" height="26" rx="5" fill={accent} stroke={ink} strokeWidth="2.4" />
        </>
      ) : (
        <>
          <path
            d="M22 18h14l12 12-16 16-12-12V18Z"
            fill={accent}
            stroke={ink}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="28" cy="25" r="2.5" fill="#FFFFFF" />
        </>
      )}
    </svg>
  )
}

/**
 * Uber / PickMe-style rounded item thumbnail supporting both built-in library
 * presets and compressed gallery photos.
 */
export default function ItemThumbnail({
  image,
  alt,
  size = "sm",
  className = "",
  showPlaceholder = false,
}: ItemThumbnailProps) {
  const preset = getImagePreset(image)
  const isPhoto = isDataImageUrl(image)

  if (!preset && !isPhoto) {
    if (!showPlaceholder) return null
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center border border-dashed border-warm-border bg-ivory text-muted ${SIZE_CLASSES[size]} ${className}`.trim()}
      >
        <ImageIcon size={size === "xs" ? 14 : 18} />
      </div>
    )
  }

  return (
    <div
      className={`shrink-0 overflow-hidden border border-warm-border/75 bg-white shadow-subtle ${SIZE_CLASSES[size]} ${className}`.trim()}
    >
      {isPhoto ? (
        <img
          src={image}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : preset ? (
        <PresetArtwork preset={preset} />
      ) : null}
    </div>
  )
}
