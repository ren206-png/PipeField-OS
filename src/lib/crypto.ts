// ============================================================
// AES-256-GCM encryption for sensitive stored secrets
// (ERP API keys, webhook secrets, OAuth tokens, etc.)
//
// Requires env var: ENCRYPTION_KEY — a 64-char hex string (32 bytes).
// Generate with: openssl rand -hex 32
//
// Format stored: <12-byte iv hex>:<16-byte auth tag hex>:<ciphertext hex>
// All three parts are required for decryption — tampering with any
// part causes decryption to throw (GCM authentication failure).
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env var is missing or not 64 hex chars. ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a single storable string: "<iv>:<authTag>:<ciphertext>" (all hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a value produced by encrypt().
 * Throws if the ciphertext has been tampered with (GCM auth failure).
 */
export function decrypt(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted value format')

  const [ivHex, authTagHex, ciphertextHex] = parts
  const key        = getKey()
  const iv         = Buffer.from(ivHex, 'hex')
  const authTag    = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * True if the stored value looks like a legacy base64 blob (not AES-GCM).
 * Used during migration to decrypt old base64 values transparently.
 */
export function isLegacyBase64(stored: string): boolean {
  return !stored.includes(':')
}

/**
 * Decrypt any stored key — handles both legacy base64 and new AES-GCM format.
 * After all rows are re-encrypted, this migration path can be removed.
 */
export function decryptKey(stored: string): string {
  if (isLegacyBase64(stored)) {
    // Legacy: plain base64 — return as-is with a warning
    console.warn('[crypto] decrypting legacy base64 key — re-encrypt this connector')
    return Buffer.from(stored, 'base64').toString('utf8')
  }
  return decrypt(stored)
}
