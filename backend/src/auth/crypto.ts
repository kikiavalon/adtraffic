import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * AES-256-GCM encryption utilities for OAuth token storage.
 *
 * Tokens are encrypted at rest in the database. The encryption key is sourced
 * from the ENCRYPTION_KEY environment variable. In development, falls back to
 * a key derived from JWT_SECRET (NOT recommended for production).
 *
 * Encrypted format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 *
 * AES-256-GCM provides:
 *   - Confidentiality (AES-256 encryption)
 *   - Integrity (GCM authentication tag — tampered ciphertext is rejected)
 *   - Unique IV per encryption (prevents pattern analysis)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Resolve the 256-bit encryption key.
 *
 * Priority:
 *   1. ENCRYPTION_KEY env var (must be exactly 64 hex chars = 32 bytes)
 *   2. SHA-256 hash of JWT_SECRET (dev fallback only)
 *
 * Throws in production if ENCRYPTION_KEY is not set.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey) {
    // Validate: must be 64 hex characters (32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 64 hex characters (256 bits). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return Buffer.from(envKey, 'hex');
  }

  // Fallback: derive from JWT_SECRET (dev only)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY must be set in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'Neither ENCRYPTION_KEY nor JWT_SECRET is set. ' +
      'At least one is required for token encryption.'
    );
  }

  // SHA-256 produces exactly 32 bytes — the right size for AES-256
  return createHash('sha256').update(jwtSecret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt (e.g., an OAuth access token)
 * @returns Encrypted string in format `iv:authTag:ciphertext` (all hex-encoded)
 * @throws If encryption key is not available or plaintext is empty
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string that was encrypted with `encrypt()`.
 *
 * @param encrypted - Encrypted string in format `iv:authTag:ciphertext` (hex-encoded)
 * @returns The original plaintext string
 * @throws If the format is invalid, the key is wrong, or the data has been tampered with
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty string');
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted format. Expected "iv:authTag:ciphertext" (hex-encoded).'
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

  // Validate hex lengths
  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH * 2} hex chars, got ${ivHex.length}`);
  }
  if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH * 2} hex chars, got ${authTagHex.length}`);
  }
  if (ciphertextHex.length === 0) {
    throw new Error('Ciphertext is empty');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
