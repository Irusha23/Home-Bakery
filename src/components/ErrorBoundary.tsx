import { Component, type ErrorInfo, type ReactNode } from "react"
import { RotateCcw, ShieldAlert } from "lucide-react"

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

/**
 * Top-level React error boundary preventing blank screens on unexpected runtime errors.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error:", error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }

    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-10 text-cocoa">
        <section
          role="alert"
          aria-labelledby="error-boundary-title"
          className="w-full max-w-md rounded-card border border-warm-border bg-white p-6 shadow-card"
        >
          <div className="inline-flex size-11 items-center justify-center rounded-full bg-error-soft text-error">
            <ShieldAlert aria-hidden="true" size={22} />
          </div>
          <h1
            id="error-boundary-title"
            className="mt-4 text-xl font-semibold text-cocoa"
          >
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your saved bakery data is safe. Try returning to the screen or
            reloading the app.
          </p>
          {error.message ? (
            <p className="mt-3 rounded-control bg-neutral-soft px-3 py-2 text-xs text-muted break-words">
              {error.message}
            </p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-control bg-sage px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.97]"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-control border border-warm-border bg-white px-4 py-2.5 text-sm font-semibold text-cocoa transition hover:bg-neutral-soft active:scale-[0.97]"
            >
              <RotateCcw aria-hidden="true" size={15} />
              Reload app
            </button>
          </div>
        </section>
      </main>
    )
  }
}
