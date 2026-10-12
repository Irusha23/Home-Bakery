type CheckboxFieldProps = {
  checked: boolean
  label: string
  description?: string
  onChange: (checked: boolean) => void
}

export default function CheckboxField({
  checked,
  label,
  description,
  onChange,
}: CheckboxFieldProps) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-control border border-warm-border bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 rounded border-warm-border accent-sage"
      />
      <span>
        <span className="block text-sm font-semibold text-cocoa">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}
