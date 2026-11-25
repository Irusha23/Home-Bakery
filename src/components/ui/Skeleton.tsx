type SkeletonProps = {
  className?: string
}

export default function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-control bg-neutral-soft ${className}`}
    />
  )
}
