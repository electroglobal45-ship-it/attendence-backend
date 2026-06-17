import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag (GCM default)

const BCRYPT_ROUNDS = 12

/**
 * Returns the 32-byte encryption key from the environment.
 * Throws clearly if the key is missing or the wrong length.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not set')

  const key = Buffer.from(raw, 'hex')
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${key.length} bytes.`
    )
  }
  return key
}

/**
 * Returns the vault pepper from environment.
 * Throws if not set.
 */
function getPepper(): string {
  const pepper = process.env.VAULT_PEPPER
  if (!pepper) throw new Error('VAULT_PEPPER environment variable is not set')
  return pepper
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a single string in the format:  <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptPassword(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts a string produced by encryptPassword().
 * Throws if the data is tampered with (GCM auth tag mismatch).
 */
export function decryptPassword(encryptedData: string): string {
  const key = getKey()
  const parts = encryptedData.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')

  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Hashes a plaintext password with bcrypt (cost=12) + a server-side pepper.
 * Salt is automatically embedded in the bcrypt output.
 *
 * Use for VERIFICATION layer — original plaintext is NOT recoverable from this hash.
 * Use encryptPassword() when reveal is needed.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const peppered = plaintext + getPepper()
  return bcrypt.hash(peppered, BCRYPT_ROUNDS)
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * Pepper is re-applied before comparison.
 */
export async function verifyPasswordHash(
  plaintext: string,
  hash: string
): Promise<boolean> {
  const peppered = plaintext + getPepper()
  return bcrypt.compare(peppered, hash)
}

