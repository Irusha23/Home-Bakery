export type BackupExportMethod = "share" | "download"

export type BackupShareOptions = {
  filename: string
  content: string
  title: string
  text: string
}

/**
 * Exports a backup file using the native Web Share Sheet when supported
 * (enabling 1-tap saving to Google Drive or WhatsApp on Android Chrome),
 * falling back cleanly to browser file download. Phase 15 plugs native
 * `@capacitor/filesystem` + `@capacitor/share` behind this same contract.
 */
export async function shareOrDownloadBackupFile({
  filename,
  content,
  title,
  text,
}: BackupShareOptions): Promise<{
  method: BackupExportMethod
  cancelled?: boolean
}> {
  if (typeof File !== "undefined" && typeof navigator !== "undefined") {
    const file = new File([content], filename, { type: "application/json" })
    if (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title, text })
        return { method: "share" }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { method: "share", cancelled: true }
        }
      }
    }
  }

  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json;charset=utf-8" }),
  )
  try {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }

  return { method: "download" }
}
