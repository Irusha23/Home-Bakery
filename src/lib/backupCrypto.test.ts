import { describe, expect, it } from "vitest"
import { createStarterData } from "../data/starterData"
import { createBackupEnvelope, parseBackup } from "../state/persistence"
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupRaw,
} from "./backupCrypto"

describe("password-protected backup crypto", () => {
  it("encrypts and decrypts a full v2 backup envelope round-trip", async () => {
    const exportedAt = "2026-10-12T18:26:07.241Z"
    const starter = createStarterData()
    const envelope = createBackupEnvelope(starter, exportedAt)
    const plaintext = JSON.stringify(envelope, null, 2)

    const encrypted = await encryptBackupPayload(
      plaintext,
      "udeni-secret-pass",
      exportedAt,
    )
    expect(isEncryptedBackupRaw(encrypted)).toBe(true)
    expect(isEncryptedBackupRaw(plaintext)).toBe(false)
    expect(isEncryptedBackupRaw("not-json")).toBe(false)

    const decrypted = await decryptBackupPayload(encrypted, "udeni-secret-pass")
    expect(decrypted).toBe(plaintext)
    expect(parseBackup(decrypted)).toEqual(starter)
  })

  it("rejects wrong passwords cleanly", async () => {
    const encrypted = await encryptBackupPayload(
      JSON.stringify({ ok: true }),
      "correct-horse-1",
    )

    await expect(
      decryptBackupPayload(encrypted, "wrong-password-2"),
    ).rejects.toThrow("Incorrect backup password or corrupted backup file.")
  })

  it("rejects tampered ciphertext via AES-GCM authentication", async () => {
    const encrypted = await encryptBackupPayload(
      JSON.stringify({ ok: true }),
      "valid-pass-123",
    )
    const parsed = JSON.parse(encrypted) as { ciphertext: string }
    const flipped =
      parsed.ciphertext.slice(0, -2) +
      (parsed.ciphertext.slice(-2) === "==" ? "AB" : "ZZ")
    const tampered = JSON.stringify({ ...parsed, ciphertext: flipped })

    await expect(
      decryptBackupPayload(tampered, "valid-pass-123"),
    ).rejects.toThrow("Incorrect backup password or corrupted backup file.")
  })

  it("rejects short passwords below minimum length", async () => {
    await expect(
      encryptBackupPayload(JSON.stringify({ ok: true }), "123"),
    ).rejects.toThrow(/at least 6 characters/i)
  })
})
