import { motion, useReducedMotion } from "motion/react"
import { REDUCED_MOTION_TRANSITION, SPRING_ELASTIC } from "../../lib/motion"

export type IllustrationName =
  | "shopping-cart"
  | "cake-box"
  | "caught-up-cupcake"
  | "recipe-book"
  | "money-jar"
  | "all-clear-bell"
  | "customers-wave"
  | "loading-cupcake"
  | "kitchen-prep"
  | "timer-bell"

type IllustrationSize = "sm" | "md" | "lg"

type IllustrationProps = {
  name: IllustrationName
  size?: IllustrationSize
  className?: string
}

const SIZE_CLASSES: Record<IllustrationSize, string> = {
  sm: "w-16 h-14",
  md: "w-28 h-24",
  lg: "w-36 h-28",
}

function renderArtwork(name: IllustrationName) {
  switch (name) {
    case "shopping-cart":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          {/* Soft motion puffs */}
          <path
            d="M16 98c4-6 12-7 17-3 4-4 11-3 14 2h12c3 0 5 2 5 5H14c-1-2 0-4 2-4Z"
            fill="#DBEAFE"
          />
          <path
            d="M84 100c3-4 9-4 12-1 3-3 8-2 10 2h8c2 0 3 1 3 3H82c-1-1 0-3 2-4Z"
            fill="#DBEAFE"
          />
          <circle cx="28" cy="83" r="2.5" fill="#60A5FA" />
          <circle cx="22" cy="91" r="1.8" fill="#93C5FD" />

          {/* Floating geometric accents */}
          <circle cx="94" cy="14" r="3.5" fill="#059669" />
          <circle cx="102" cy="30" r="6" fill="#6EE7B7" />
          <rect
            x="78"
            y="28"
            width="18"
            height="18"
            rx="4"
            transform="rotate(45 78 28)"
            fill="#FBBF24"
          />
          <rect
            x="116"
            y="34"
            width="16"
            height="32"
            rx="8"
            transform="rotate(35 116 34)"
            fill="#93C5FD"
          />

          {/* Cart basket */}
          <path
            d="M52 50h58c3 0 5 2.6 4.4 5.5l-4.8 24c-.5 2.4-2.6 4.1-5 4.1H60l-8-33.6Z"
            fill="#E11D48"
          />
          <path
            d="M52 50h10l7 33.6H60l-8-33.6Z"
            fill="#9F1239"
          />
          {/* Cart slots */}
          <rect x="69" y="59" width="4" height="16" rx="2" fill="#FDA4AF" />
          <rect x="78" y="59" width="4" height="16" rx="2" fill="#FDA4AF" />
          <rect x="87" y="59" width="4" height="16" rx="2" fill="#FDA4AF" />
          <rect x="96" y="59" width="4" height="16" rx="2" fill="#FDA4AF" />

          {/* Frame & handle */}
          <path
            d="M38 40h10.5c2 0 3.7 1.4 4.1 3.3l7.8 36.4c.5 2.4-1.3 4.8-3.8 4.8h-2.1c-3.5 0-5.8 3.6-4.2 6.8.7 1.3 2 2.2 3.5 2.2H106"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="33" y="37" width="11" height="5.5" rx="2.75" fill="#0F172A" />

          {/* Wheels */}
          <circle cx="62" cy="98" r="7.5" fill="#334155" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="62" cy="98" r="2.2" fill="#F8FAFC" />
          <circle cx="98" cy="98" r="7.5" fill="#334155" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="98" cy="98" r="2.2" fill="#F8FAFC" />
        </svg>
      )

    case "cake-box":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          {/* Ground shadow */}
          <ellipse cx="80" cy="105" rx="44" ry="7" fill="#E2E8F0" />

          {/* Floating accents */}
          <circle cx="34" cy="40" r="4.5" fill="#6EE7B7" />
          <circle cx="128" cy="34" r="3.5" fill="#FBBF24" />
          <rect
            x="122"
            y="50"
            width="12"
            height="12"
            rx="3"
            transform="rotate(30 122 50)"
            fill="#93C5FD"
          />
          <circle cx="42" cy="24" r="2.5" fill="#F43F5E" />

          {/* Bakery box body */}
          <rect
            x="44"
            y="52"
            width="72"
            height="48"
            rx="9"
            fill="#FFF1F2"
            stroke="#0F172A"
            strokeWidth="3"
          />
          {/* Box lid */}
          <rect
            x="39"
            y="42"
            width="82"
            height="15"
            rx="6"
            fill="#FECDD3"
            stroke="#0F172A"
            strokeWidth="3"
          />
          {/* Vertical ribbon */}
          <rect x="74" y="42" width="12" height="58" fill="#E11D48" />
          {/* Ribbon bow */}
          <path
            d="M80 42c-8-12-22-10-20-1 1.5 6 12 4 20 1Zm0 0c8-12 22-10 20-1-1.5 6-12 4-20 1Z"
            fill="#FB7185"
            stroke="#0F172A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="80" cy="42" r="4.5" fill="#E11D48" stroke="#0F172A" strokeWidth="2.5" />
        </svg>
      )

    case "caught-up-cupcake":
    case "loading-cupcake":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          {/* Soft base puff */}
          <ellipse cx="80" cy="106" rx="40" ry="6.5" fill="#DBEAFE" />

          {/* Floating sparkles */}
          <circle cx="36" cy="42" r="4" fill="#FBBF24" />
          <circle cx="125" cy="46" r="5" fill="#6EE7B7" />
          <circle cx="116" cy="24" r="3" fill="#60A5FA" />
          <rect
            x="44"
            y="22"
            width="10"
            height="10"
            rx="2.5"
            transform="rotate(45 44 22)"
            fill="#FDA4AF"
          />

          {/* Cupcake wrapper */}
          <path
            d="M52 66h56l-7 34c-.5 2.3-2.5 4-4.9 4H63.9c-2.4 0-4.4-1.7-4.9-4L52 66Z"
            fill="#FBBF24"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M66 68v33M80 68v33M94 68v33" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />

          {/* Frosted swirl */}
          <path
            d="M46 64c0-9 8-15 17-15 2-9 10-15 19-15 10 0 18 6 19 15 9 0 15 6 15 15 0 5-4 8-9 8H55c-5 0-9-3-9-8Z"
            fill="#FFF1F2"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Sprinkles */}
          <rect x="64" y="54" width="7" height="3" rx="1.5" transform="rotate(-20 64 54)" fill="#E11D48" />
          <rect x="88" y="52" width="7" height="3" rx="1.5" transform="rotate(25 88 52)" fill="#10B981" />
          <rect x="76" y="45" width="7" height="3" rx="1.5" transform="rotate(10 76 45)" fill="#60A5FA" />

          {/* Cherry on top */}
          <path d="M80 34c2-7 8-11 13-11" stroke="#059669" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="80" cy="31" r="7.5" fill="#E11D48" stroke="#0F172A" strokeWidth="2.8" />
          <circle cx="77.5" cy="28.5" r="2" fill="#FDA4AF" />
        </svg>
      )

    case "recipe-book":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          <ellipse cx="80" cy="106" rx="44" ry="6.5" fill="#E2E8F0" />

          {/* Accents */}
          <circle cx="32" cy="36" r="4.5" fill="#FBBF24" />
          <circle cx="128" cy="32" r="5.5" fill="#93C5FD" />
          <circle cx="122" cy="52" r="3" fill="#6EE7B7" />

          {/* Open book cover */}
          <rect
            x="38"
            y="36"
            width="84"
            height="64"
            rx="8"
            fill="#E11D48"
            stroke="#0F172A"
            strokeWidth="3"
          />
          {/* Left & right pages */}
          <path
            d="M44 41h33c2 0 3 1.5 3 3.5V94H44V41Z"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="2.5"
          />
          <path
            d="M80 44.5c0-2 1-3.5 3-3.5h33v53H80V44.5Z"
            fill="#F8FAFC"
            stroke="#0F172A"
            strokeWidth="2.5"
          />
          {/* Recipe lines */}
          <rect x="51" y="51" width="21" height="4" rx="2" fill="#FDA4AF" />
          <rect x="51" y="61" width="18" height="3.5" rx="1.75" fill="#CBD5E1" />
          <rect x="51" y="70" width="21" height="3.5" rx="1.75" fill="#CBD5E1" />
          <rect x="51" y="79" width="15" height="3.5" rx="1.75" fill="#CBD5E1" />

          {/* Mini cupcake doodle on right page */}
          <circle cx="98" cy="60" r="7" fill="#FBBF24" />
          <path d="M92 66h12l-1.8 10h-8.4L92 66Z" fill="#60A5FA" />
          <rect x="89" y="82" width="18" height="3.5" rx="1.75" fill="#CBD5E1" />
        </svg>
      )

    case "money-jar":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          <ellipse cx="80" cy="107" rx="40" ry="6.5" fill="#DBEAFE" />

          {/* Floating coins & sparkles */}
          <circle cx="42" cy="36" r="7.5" fill="#FBBF24" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="118" cy="40" r="6" fill="#6EE7B7" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="108" cy="20" r="3.5" fill="#60A5FA" />

          {/* Jar body */}
          <rect
            x="52"
            y="42"
            width="56"
            height="60"
            rx="16"
            fill="#ECFDF5"
            stroke="#0F172A"
            strokeWidth="3"
          />
          {/* Jar neck & lid */}
          <rect
            x="58"
            y="30"
            width="44"
            height="12"
            rx="4"
            fill="#FBBF24"
            stroke="#0F172A"
            strokeWidth="3"
          />
          {/* Coins inside */}
          <circle cx="71" cy="84" r="8" fill="#FBBF24" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="88" cy="86" r="8" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="80" cy="72" r="8" fill="#FBBF24" stroke="#0F172A" strokeWidth="2.5" />
          {/* Shine */}
          <path d="M62 54v18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )

    case "all-clear-bell":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          <ellipse cx="80" cy="105" rx="38" ry="6.5" fill="#E2E8F0" />

          {/* Accents */}
          <circle cx="38" cy="42" r="4.5" fill="#6EE7B7" />
          <circle cx="124" cy="40" r="3.5" fill="#FBBF24" />
          <circle cx="46" cy="24" r="2.5" fill="#60A5FA" />

          {/* Bell body */}
          <path
            d="M80 28c-16 0-26 12-26 28v16l-7 10h66l-7-10V56c0-16-10-28-26-28Z"
            fill="#FBBF24"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="80" cy="89" r="7" fill="#D97706" stroke="#0F172A" strokeWidth="2.8" />

          {/* Mint check badge */}
          <circle cx="106" cy="38" r="14" fill="#10B981" stroke="#0F172A" strokeWidth="2.8" />
          <path
            d="M100 38l4 4 8-8"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )

    case "customers-wave":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          <ellipse cx="80" cy="106" rx="40" ry="6.5" fill="#DBEAFE" />

          {/* Accents */}
          <circle cx="34" cy="42" r="5" fill="#FDA4AF" />
          <circle cx="126" cy="36" r="4.5" fill="#FBBF24" />
          <circle cx="118" cy="56" r="3" fill="#6EE7B7" />

          {/* Customer card */}
          <rect
            x="44"
            y="32"
            width="72"
            height="68"
            rx="16"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="3"
          />
          {/* Avatar */}
          <circle cx="80" cy="57" r="12" fill="#FECDD3" stroke="#0F172A" strokeWidth="2.8" />
          <path
            d="M60 88c2-10 10-15 20-15s18 5 20 15"
            fill="#60A5FA"
            stroke="#0F172A"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      )

    case "kitchen-prep":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          <ellipse cx="80" cy="106" rx="44" ry="6.5" fill="#FDE68A" fillOpacity="0.4" />
          <circle cx="34" cy="40" r="4" fill="#FBBF24" />
          <circle cx="126" cy="36" r="4.5" fill="#6EE7B7" />
          <circle cx="118" cy="56" r="2.5" fill="#FB7185" />
          {/* Whisk handle */}
          <path
            d="M92 22l14-8c2.2-1.2 4.8.4 4.2 2.8L104 38"
            stroke="#F59E0B"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M95 34c-7 7-9 18-3 24s17 4 24-3c6-6 2-15-6-19-8-4-11-6-15-2Z"
            stroke="#FAF7F2"
            strokeWidth="2.5"
            fill="none"
          />
          {/* Mixing bowl */}
          <path
            d="M42 60h76c0 22-14 38-38 38S42 82 42 60Z"
            fill="#F59E0B"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect
            x="36"
            y="53"
            width="88"
            height="10"
            rx="5"
            fill="#FDE68A"
            stroke="#0F172A"
            strokeWidth="3"
          />
          <path d="M56 72c4 8 10 13 18 15" stroke="#FFFBEB" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )

    case "timer-bell":
      return (
        <svg viewBox="0 0 160 124" fill="none" className="h-full w-full">
          <ellipse cx="80" cy="107" rx="40" ry="6.5" fill="#FDE68A" fillOpacity="0.35" />
          {/* Ringing motion arcs */}
          <path d="M36 44c-6 8-6 18 0 26" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M27 38c-8 12-8 26 0 38" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <path d="M124 44c6 8 6 18 0 26" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M133 38c8 12 8 26 0 38" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          {/* Clock / kitchen timer */}
          <rect x="74" y="20" width="12" height="8" rx="3" fill="#E11D48" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="80" cy="64" r="32" fill="#FFFBEB" stroke="#0F172A" strokeWidth="3.2" />
          <circle cx="80" cy="64" r="24" fill="#FEF3C7" />
          <path d="M80 46v18l12 8" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="80" cy="64" r="4" fill="#E11D48" />
        </svg>
      )
  }
}

/**
 * Playful flat-geometric bakery illustration matched to the app's palette.
 */
export default function Illustration({
  name,
  size = "md",
  className = "",
}: IllustrationProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      aria-hidden="true"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_ELASTIC}
      className={`mx-auto select-none ${SIZE_CLASSES[size]} ${className}`.trim()}
    >
      {renderArtwork(name)}
    </motion.div>
  )
}
