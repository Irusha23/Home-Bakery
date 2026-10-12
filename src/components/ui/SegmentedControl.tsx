type Segment<T extends string,> = {
  value: T
  label: string
}

type SegmentedControlProps<T extends string,> = {
  label: string
  value: T
  segments: Segment<T>[]
  onChange: (value: T) => void
}

export default function SegmentedControl<T extends string>({
  label,
  value,
  segments,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="scrollbar-hidden flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label={label}
    >
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          aria-pressed={segment.value === value}
          onClick={() => onChange(segment.value)}
          className={`min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition duration-ui focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/25 ${
            segment.value === value
              ? "border-sage bg-sage text-white"
              : "border-warm-border bg-white text-muted hover:border-sage-border hover:text-cocoa"
          }`}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
