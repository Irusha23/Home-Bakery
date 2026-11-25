import { useRef, useState } from "react"
import { Lock, Share2 } from "lucide-react"

import Button from "./ui/Button"
import CheckboxField from "./ui/CheckboxField"
import Disclosure from "./ui/Disclosure"
import Field from "./ui/Field"

import type { AppData } from "../types"

import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupRaw,
  isWebCryptoAvailable,
  MIN_BACKUP_PASSWORD_LENGTH,
} from "../lib/backupCrypto"
import { shareOrDownloadBackupFile } from "../lib/backupShare"
import { resolveAppDataMediaForExport } from "../lib/mediaStore"
import {
  createBackupEnvelope,
  parseBackupEnvelope,
  type RecoverySource,
  type RestoreResult,
} from "../state/persistence"

type BackupRestorePanelProps = {
  data?: AppData

  recoverySource?: RecoverySource

  onRestore: (
    raw: string,
    recoverySource?: RecoverySource,
  ) => RestoreResult | Promise<RestoreResult>

  onExportComplete?: (exportedAt: string) => void
}

export default function BackupRestorePanel({
  data,

  recoverySource,

  onRestore,

  onExportComplete,
}: BackupRestorePanelProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const cryptoSupported = isWebCryptoAvailable()

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [encryptExport, setEncryptExport] = useState(false)
  const [exportPassword, setExportPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [pendingEncryptedRaw, setPendingEncryptedRaw] = useState<string | null>(
    null,
  )
  const [unlockPassword, setUnlockPassword] = useState("")
  const [unlocking, setUnlocking] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const [selectedBackup, setSelectedBackup] = useState<{
    raw: string
    exportedAt: string
    data: AppData
  } | null>(null)

  const handleExport = async () => {
    if (!data || exporting) return
    setMessage(null)
    setError(null)

    if (encryptExport) {
      if (exportPassword.length < MIN_BACKUP_PASSWORD_LENGTH) {
        setError(
          `Use a backup password of at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`,
        )
        return
      }
      if (exportPassword !== confirmPassword) {
        setError("Backup password and confirmation do not match.")
        return
      }
    }

    setExporting(true)
    try {
      const portableData = await resolveAppDataMediaForExport(data)
      const envelope = createBackupEnvelope(portableData)
      const plaintext = JSON.stringify(envelope, null, 2)
      if (typeof plaintext !== "string") {
        throw new Error("The backup could not be serialized.")
      }

      const date = envelope.exportedAt.slice(0, 10)
      const content = encryptExport
        ? await encryptBackupPayload(
            plaintext,
            exportPassword,
            envelope.exportedAt,
          )
        : plaintext
      const filename = encryptExport
        ? `Udenis-Specials-Encrypted-Backup-${date}.json`
        : `Udenis-Specials-Backup-${date}.json`

      const result = await shareOrDownloadBackupFile({
        filename,
        content,
        title: `Udeni's Specials Backup (${date})`,
        text: encryptExport
          ? "Password-protected bakery backup file."
          : "Udeni's Specials bakery backup file.",
      })

      if (result.cancelled) {
        setMessage("Backup sharing was cancelled.")
        return
      }

      onExportComplete?.(envelope.exportedAt)
      setExportPassword("")
      setConfirmPassword("")
      setMessage(
        result.method === "share"
          ? "Backup ready in Share Sheet (Google Drive / WhatsApp)."
          : "Backup download has been prepared.",
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The backup could not be prepared.",
      )
    } finally {
      setExporting(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    setSelectedBackup(null)
    setPendingEncryptedRaw(null)
    setUnlockPassword("")
    setMessage(null)
    setError(null)

    if (!file) return

    try {
      const raw = await file.text()
      if (isEncryptedBackupRaw(raw)) {
        setPendingEncryptedRaw(raw)
        return
      }

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

  const handleUnlockEncrypted = async () => {
    if (!pendingEncryptedRaw || unlocking) return
    setError(null)
    setUnlocking(true)
    try {
      const decrypted = await decryptBackupPayload(
        pendingEncryptedRaw,
        unlockPassword,
      )
      const backup = parseBackupEnvelope(decrypted)
      setPendingEncryptedRaw(null)
      setUnlockPassword("")
      setSelectedBackup({
        raw: decrypted,
        exportedAt: backup.exportedAt,
        data: backup.data,
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not unlock this encrypted backup.",
      )
    } finally {
      setUnlocking(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedBackup || restoring) return
    setError(null)
    setMessage(null)
    setRestoring(true)
    try {
      const result = await onRestore(selectedBackup.raw, recoverySource)

      if (result.ok) {
        setSelectedBackup(null)
        setMessage("Backup restored and saved successfully.")
        setError(null)
        if (fileInput.current) fileInput.current.value = ""
      } else {
        setMessage(null)
        setError(result.error)
      }
    } catch (caught) {
      setMessage(null)
      setError(
        caught instanceof Error
          ? caught.message
          : "The selected backup could not be restored.",
      )
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Disclosure
      title="Backup and restore"
      contentClassName="space-y-4 border-t border-warm-border p-4"
    >
      {data ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            Export a portable backup (with your attached photos) to Google Drive,
            WhatsApp, or device storage, or restore a previously saved file.
          </p>

          {cryptoSupported ? (
            <CheckboxField
              checked={encryptExport}
              onChange={(checked) => {
                setEncryptExport(checked)
                setError(null)
              }}
              label="Password-protect backup (AES-256 encrypted)"
            />
          ) : (
            <p className="text-xs text-muted">
              Password encryption activates on HTTPS or inside the installed
              Android app.
            </p>
          )}

          {encryptExport ? (
            <div className="space-y-3 rounded-control border border-warm-border bg-ivory p-3.5">
              <Field
                label="Backup password"
                type="password"
                value={exportPassword}
                onChange={(event) => {
                  setExportPassword(event.target.value)
                  setError(null)
                }}
                placeholder={`At least ${MIN_BACKUP_PASSWORD_LENGTH} characters`}
              />
              <Field
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setError(null)
                }}
                placeholder="Re-enter backup password"
              />
              <p className="text-xs leading-relaxed text-muted">
                This password is never saved anywhere in the app. If you lose it,
                the encrypted backup cannot be recovered.
              </p>
            </div>
          ) : null}

          <Button
            variant="secondary"
            disabled={exporting}
            leadingIcon={
              encryptExport ? (
                <Lock aria-hidden="true" size={16} />
              ) : (
                <Share2 aria-hidden="true" size={16} />
              )
            }
            onClick={() => void handleExport()}
          >
            {exporting
              ? "Preparing backup..."
              : encryptExport
                ? "Export encrypted backup"
                : "Export & share backup"}
          </Button>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Select a valid backup to restore your data. The saved value
          associated with this recovery screen will be preserved before restore.
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
          accept=".json,application/json,application/octet-stream,text/plain,*/*"
          className="block min-h-touch w-full rounded-control border border-warm-border bg-ivory px-3 py-2 text-sm text-cocoa file:mr-3 file:rounded-control file:border-0 file:bg-sage-soft file:px-3 file:py-2 file:font-semibold file:text-sage-dark focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30"
          onChange={(event) => {
            const picked = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            void handleFile(picked)
          }}
        />
      </div>

      {pendingEncryptedRaw ? (
        <div
          role="group"
          aria-label="Unlock encrypted backup"
          className="space-y-3 rounded-control border border-sage-border bg-sage-soft/50 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-cocoa">
            <Lock aria-hidden="true" size={15} />
            Encrypted backup detected
          </p>
          <Field
            label="Backup password"
            type="password"
            value={unlockPassword}
            onChange={(event) => {
              setUnlockPassword(event.target.value)
              setError(null)
            }}
            placeholder="Enter password to unlock"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={unlocking}
              onClick={() => void handleUnlockEncrypted()}
            >
              {unlocking ? "Unlocking..." : "Unlock backup"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPendingEncryptedRaw(null)
                setUnlockPassword("")
                if (fileInput.current) fileInput.current.value = ""
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

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
            <Button
              disabled={restoring}
              onClick={() => void handleRestore()}
            >
              {restoring ? "Restoring..." : "Confirm restore"}
            </Button>
            <Button
              variant="secondary"
              disabled={restoring}
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
    </Disclosure>
  )
}
