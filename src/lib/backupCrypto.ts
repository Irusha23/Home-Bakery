export const ENCRYPTED_BACKUP_FORMAT = "udenis-specials-encrypted-backup"
export const ENCRYPTED_BACKUP_VERSION = 1
export const BACKUP_PBKDF2_ITERATIONS = 210_000
export const MIN_BACKUP_PASSWORD_LENGTH = 6

export type EncryptedBackupEnvelope = {
  format: typeof ENCRYPTED_BACKUP_FORMAT
  version: typeof ENCRYPTED_BACKUP_VERSION
  exportedAt: string
  kdf: {
    algorithm: "PBKDF2"
    hash: "SHA-256"
    iterations: number
    salt: string
  }
  cipher: {
    algorithm: "AES-GCM"
    iv: string
  }
  ciphertext: string
}

export function isWebCryptoAvailable(): boolean {
  return Boolean(
    typeof globalThis !== "undefined" &&
      globalThis.crypto?.subtle &&
      globalThis.crypto?.getRandomValues,
  )
}

export function isEncryptedBackupRaw(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Partial<EncryptedBackupEnvelope> | null
    return (
      Boolean(parsed) &&
      typeof parsed === "object" &&
      parsed?.format === ENCRYPTED_BACKUP_FORMAT
    )
  } catch {
    return false
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  )
}

/**
 * Encrypts serialized JSON backup contents with PBKDF2-SHA256 + AES-256-GCM.
 * Passwords are never persisted in app settings or inside the backup payload.
 */
export async function encryptBackupPayload(
  plaintextJson: string,
  password: string,
  exportedAt = new Date().toISOString(),
): Promise<string> {
  if (!isWebCryptoAvailable()) {
    throw new Error(
      "Backup encryption requires Web Crypto (HTTPS or Android app context).",
    )
  }
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new Error(
      `Choose a backup password of at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`,
    )
  }

  const salt = new Uint8Array(new ArrayBuffer(16))
  const iv = new Uint8Array(new ArrayBuffer(12))
  globalThis.crypto.getRandomValues(salt)
  globalThis.crypto.getRandomValues(iv)

  const key = await deriveAesKey(
    password,
    salt,
    BACKUP_PBKDF2_ITERATIONS,
    "encrypt",
  )
  const plaintextBytes = new TextEncoder().encode(plaintextJson)
  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes,
  )

  const envelope: EncryptedBackupEnvelope = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    exportedAt,
    kdf: {
      algorithm: "PBKDF2",
      hash: "SHA-256",
      iterations: BACKUP_PBKDF2_ITERATIONS,
      salt: uint8ToBase64(salt),
    },
    cipher: {
      algorithm: "AES-GCM",
      iv: uint8ToBase64(iv),
    },
    ciphertext: uint8ToBase64(new Uint8Array(cipherBuffer)),
  }

  return JSON.stringify(envelope, null, 2)
}

/**
 * Decrypts a password-protected backup envelope back to its plaintext JSON
 * string for standard backup schema validation and restoration.
 */
export async function decryptBackupPayload(
  encryptedRaw: string,
  password: string,
): Promise<string> {
  if (!isWebCryptoAvailable()) {
    throw new Error(
      "Backup decryption requires Web Crypto (HTTPS or Android app context).",
    )
  }
  if (!password) {
    throw new Error("Enter the password used when this backup was exported.")
  }

  let parsed: Partial<EncryptedBackupEnvelope>
  try {
    parsed = JSON.parse(encryptedRaw) as Partial<EncryptedBackupEnvelope>
  } catch {
    throw new Error("The selected encrypted backup file could not be parsed.")
  }

  if (
    parsed.format !== ENCRYPTED_BACKUP_FORMAT ||
    parsed.version !== ENCRYPTED_BACKUP_VERSION ||
    parsed.kdf?.algorithm !== "PBKDF2" ||
    parsed.kdf.hash !== "SHA-256" ||
    typeof parsed.kdf.iterations !== "number" ||
    parsed.kdf.iterations < 10_000 ||
    typeof parsed.kdf.salt !== "string" ||
    parsed.cipher?.algorithm !== "AES-GCM" ||
    typeof parsed.cipher.iv !== "string" ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new Error("Unsupported or corrupted encrypted backup envelope.")
  }

  try {
    const salt = base64ToUint8(parsed.kdf.salt)
    const iv = base64ToUint8(parsed.cipher.iv)
    const ciphertext = base64ToUint8(parsed.ciphertext)
    const key = await deriveAesKey(
      password,
      salt,
      parsed.kdf.iterations,
      "decrypt",
    )
    const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    )
    return new TextDecoder().decode(plaintextBuffer)
  } catch {
    throw new Error("Incorrect backup password or corrupted backup file.")
  }
}
