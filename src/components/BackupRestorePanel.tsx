import { useRef, useState } from "react"

import Button from "./ui/Button"

import type { AppData } from "../types"

import {
  createBackupEnvelope,
  parseBackupEnvelope,
  serializeBackup,
  type RecoverySource,
  type RestoreResult,
} from "../state/persistence"

type BackupRestorePanelProps = {
  data?: AppData

  recoverySource?: RecoverySource

  onRestore: (raw: string, recoverySource?: RecoverySource) => RestoreResult

  onExportComplete?: (exportedAt: string) => void
}

function downloadBackup(data: AppData): string {
  const envelope = createBackupEnvelope(data)

  const content = JSON.stringify(envelope, null, 2)

  if (typeof content !== "string") {
    throw new Error("The backup could not be serialized.")
  }

  const date = envelope.exportedAt.slice(0, 10)

  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json;charset=utf-8" }),
  )

  try {
    const link = document.createElement("a")

    link.href = url

    link.download = `Udeni's-Specials-Backup-${date}.json`

    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }

  return envelope.exportedAt
}

export default function BackupRestorePanel({
  data,

  recoverySource,

  onRestore,

  onExportComplete,
}: BackupRestorePanelProps) {
  const fileInput = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  const [selectedBackup, setSelectedBackup] = useState<{
    raw: string

    exportedAt: string

    data: AppData
  } | null>(null)

  const handleExport = () => {
    if (!data) return

    try {
      const exportedAt = downloadBackup(data)

      onExportComplete?.(exportedAt)

      setError(null)

      setMessage("Backup download has been prepared.")
    } catch {
      setMessage(null)

      setError("The backup could not be prepared for download.")
    }
  }

  const handleFile = async (file: File | undefined) => {
    setSelectedBackup(null)

    setMessage(null)

    setError(null)

    if (!file) return

    try {
      const raw = await file.text()

      const backup = parseBackupEnvelope(raw)

      setSelectedBackup({
        raw,

        exportedAt: backup.exportedAt,

        data: backup.data,
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The selected backup could not be read.",
      )
    }
  }

  const handleRestore = () => {
    if (!selectedBackup) return

    const result = onRestore(selectedBackup.raw, recoverySource)

    if (result.ok) {
      setSelectedBackup(null)

      setMessage("Backup restored and saved successfully.")

      setError(null)

      if (fileInput.current) fileInput.current.value = ""
    } else {
      setMessage(null)

      setError(result.error)
    }
  }

  return (
    <details className="rounded-card border border-warm-border bg-white p-4 shadow-subtle">
      <summary className="cursor-pointer font-semibold text-cocoa focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30">
        Backup and restore
      </summary>
      <div className="mt-4 space-y-4">
        {data ? (
          <div>
            <p className="text-sm leading-relaxed text-muted">
              Export a local JSON backup of all saved bakery records, or select
              a previously exported backup to validate and restore.
            </p>
            <Button className="mt-3" variant="secondary" onClick={handleExport}>
              Export current data
            </Button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            Select a valid backup to restore your data. The saved value
            associated with this recovery screen will be preserved before
            restore.
          </p>
        )}
        <div>
          <label
            htmlFor="backup-file"
            className="mb-2 block text-sm font-semibold text-cocoa"
          >
            Choose a Udeni’s Specials backup file
          </label>
          <input
            ref={fileInput}
            id="backup-file"
            type="file"
            accept="application/json,.json"
            className="block min-h-touch w-full rounded-control border border-warm-border bg-ivory px-3 py-2 text-sm text-cocoa file:mr-3 file:rounded-control file:border-0 file:bg-sage-soft file:px-3 file:py-2 file:font-semibold file:text-sage-dark focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30"
            onChange={(event) =>
              void handleFile(event.currentTarget.files?.[0])
            }
          />
        </div>
        {selectedBackup ? (
          <div
            role="group"
            aria-label="Review backup restore"
            className="rounded-control border border-warning-border bg-warning-soft p-4"
          >
            <p className="font-semibold">Backup validated</p>
            <p className="mt-1 text-sm leading-relaxed">
              Exported {new Date(selectedBackup.exportedAt).toLocaleString()}.
              Restoring will replace all current application data, including
              orders, payments, inventory, preparation records, and history.
              Frozen snapshots will be kept exactly as supplied by the backup.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={handleRestore}>Confirm restore</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedBackup(null)

                  if (fileInput.current) fileInput.current.value = ""
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-sage-dark">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  )
}
