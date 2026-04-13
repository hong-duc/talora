/**
 * ai-crypto.ts
 * Server-side AES-256-GCM encryption for AI API keys.
 *
 * Why: API keys must never be stored or served in plaintext.
 * The encryption key lives only in the server environment (SETTINGS_ENCRYPTION_KEY).
 * This module is only imported by API routes — never by client-side code.
 *
 * How:
 *  - encryptApiKey(plain)   → base64(iv + tag + ciphertext)
 *  - decryptApiKey(encoded) → original plaintext key
 */

// The encryption key must be a 32-byte hex string (64 hex chars) in the env.
// Example: openssl rand -hex 32
function getEncryptionKey(): Buffer {
    const hex = import.meta.env.SETTINGS_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            'SETTINGS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
            'Generate one with: openssl rand -hex 32'
        );
    }
    return Buffer.from(hex, 'hex');
}

// Encode three parts into a single storable string: iv|tag|ciphertext (all base64)
function encodeParts(iv: Buffer, tag: Buffer, cipher: Buffer): string {
    return [iv.toString('base64'), tag.toString('base64'), cipher.toString('base64')].join('|');
}

// Decode back into the three raw Buffers
function decodeParts(encoded: string): [Buffer, Buffer, Buffer] {
    const parts = encoded.split('|');
    if (parts.length !== 3) throw new Error('Invalid encrypted key format');
    return [
        Buffer.from(parts[0], 'base64'),
        Buffer.from(parts[1], 'base64'),
        Buffer.from(parts[2], 'base64'),
    ];
}

/**
 * Encrypt a plaintext API key.
 * Returns a base64-encoded string safe to store in the DB.
 * Empty strings are returned as-is (no key configured).
 */
export async function encryptApiKey(plain: string): Promise<string> {
    if (!plain) return '';

    const key = getEncryptionKey();

    // Use Node's built-in crypto via dynamic import (server-only)
    const { createCipheriv, randomBytes } = await import('node:crypto');

    const iv = randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plain, 'utf8'),
        cipher.final(),
    ]);

    // GCM auth tag — verifies ciphertext integrity on decryption
    const tag = cipher.getAuthTag();

    return encodeParts(iv, tag, encrypted);
}

/**
 * Decrypt an encrypted API key from the DB.
 * Returns the original plaintext key.
 * Empty strings are returned as-is.
 */
export async function decryptApiKey(encoded: string): Promise<string> {
    if (!encoded) return '';

    const key = getEncryptionKey();

    const { createDecipheriv } = await import('node:crypto');

    const [iv, tag, ciphertext] = decodeParts(encoded);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}

/**
 * Return a masked preview of the key for the client.
 * Only shows "••••••••" so the user knows a key is saved without exposing it.
 */
export function maskApiKey(encoded: string): string {
    return encoded ? '••••••••••••••••' : '';
}
