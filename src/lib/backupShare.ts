import { Capacitor } from "@capacitor/core"
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"

export type BackupExportMethod = "share" | "download"

export type BackupShareOptions = {
  filename: string
  content: string
  title: string
  text: string
  mimeType?: string
  dialogTitle?: string
}

function isShareCancelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    error.name === "AbortError" ||
    msg.includes("cancel") ||
    msg.includes("abort")
  )
}

/**
 * Exports a backup file using native Android Share Sheet inside Capacitor
 * (`@capacitor/filesystem` + `@capacitor/share`), Web Share API on mobile
 * browsers, or direct file download fallback.
 */
export async function shareOrDownloadBackupFile({
  filename,
  content,
  title,
  text,
  mimeType = "application/json",
  dialogTitle = "Save or share backup",
}: BackupShareOptions): Promise<{
  method: BackupExportMethod
  cancelled?: boolean
}> {
  if (Capacitor.isNativePlatform()) {
    try {
      const existing = await Filesystem.readdir({
        path: "",
        directory: Directory.Cache,
      })
      for (const entry of existing.files) {
        if (
          entry.type === "file" &&
          /^(?:Udenis-Specials-(?:Encrypted-)?Backup-|udenis-).*\.(?:json|csv)$/i.test(
            entry.name,
          ) &&
          entry.name !== filename
        ) {
          await Filesystem.deleteFile({
            path: entry.name,
            directory: Directory.Cache,
          }).catch(() => undefined)
        }
      }
    } catch {
      // Cache cleanup is best-effort
    }
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    const { uri } = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    })
    try {
      await Share.share({
        title,
        text,
        files: [uri],
        dialogTitle,
      })
      return { method: "share" }
    } catch (error) {
      if (isShareCancelError(error)) {
        return { method: "share", cancelled: true }
      }
      throw error
    }
  }

  if (typeof File !== "undefined" && typeof navigator !== "undefined") {
    const file = new File([content], filename, { type: mimeType })
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
    new Blob([content], { type: `${mimeType};charset=utf-8` }),
  )
  try {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }

  return { method: "download" }
}
