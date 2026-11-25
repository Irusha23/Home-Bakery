import { useState } from "react"

import Button from "./ui/Button"

import BackupRestorePanel from "./BackupRestorePanel"
import { shareOrDownloadBackupFile } from "../lib/backupShare"

import type {
  PersistenceRecovery,
  RecoverySource,
  RestoreResult,
} from "../state/persistence"

type PersistenceRecoveryScreenProps = {
  recovery: PersistenceRecovery

  onRetry: () => void

  onStartFresh: () => void

  onRestore: (
    raw: string,
    source?: RecoverySource,
  ) => RestoreResult | Promise<RestoreResult>
}

async function exportRawData(raw: string) {
  await shareOrDownloadBackupFile({
    filename: "udenis-specials-preserved-data.json",
    content: raw,
    title: "Udeni's Specials Preserved Data",
    text: "Raw preserved bakery storage dump for recovery.",
    dialogTitle: "Save or share preserved data",
  })
}

export default function PersistenceRecoveryScreen({
  recovery,

  onRetry,

  onStartFresh,

  onRestore,
}: PersistenceRecoveryScreenProps) {
  const [confirmFresh, setConfirmFresh] = useState(false)

  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    if (recovery.raw === null) return

    try {
      await exportRawData(recovery.raw)

      setExportError(null)
    } catch (error) {
      setExportError(
        `The preserved data could not be exported: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-10 text-cocoa">
      <section
        aria-labelledby="recovery-title"
        className="mx-auto max-w-xl rounded-card border border-warm-border bg-white p-6 shadow-card sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-dark">
          Saved data recovery
        </p>
        <h1 id="recovery-title" className="mt-2 text-2xl font-semibold">
          Your saved data was not loaded
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          The original saved value has been preserved. The application is paused
          so it cannot replace that data.
        </p>
        <p
          role="alert"
          className="mt-4 rounded-control bg-warning-soft p-4 text-sm"
        >
          {recovery.message}
        </p>
        {recovery.key ? (
          <p className="mt-3 break-all text-xs text-muted">
            Storage key: {recovery.key}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <BackupRestorePanel recoverySource={recovery} onRestore={onRestore} />
          <Button onClick={onRetry} fullWidth>
            Retry loading
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleExport()}
            disabled={recovery.raw === null}
            fullWidth
          >
            Export preserved raw data
          </Button>
          {recovery.raw === null ? (
            <p className="text-sm text-muted">
              Export is unavailable because the stored value could not be read.
            </p>
          ) : null}
          {exportError ? (
            <p role="alert" className="text-sm text-error">
              {exportError}
            </p>
          ) : null}
          {!confirmFresh ? (
            <Button
              variant="soft"
              onClick={() => setConfirmFresh(true)}
              fullWidth
            >
              Start with a fresh workspace
            </Button>
          ) : (
            <div
              role="group"
              aria-label="Confirm starting fresh"
              className="rounded-card border border-warm-border bg-ivory p-4"
            >
              <p className="text-sm leading-relaxed">
                Start with a fresh workspace? Your preserved saved value will
                not be deleted. Fresh data will be saved separately only after
                the original value has been safely preserved.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={onStartFresh}>Confirm fresh start</Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmFresh(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
