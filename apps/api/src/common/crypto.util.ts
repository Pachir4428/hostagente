import * as crypto from 'crypto';

// Symmetric encryption for secrets stored in the DB (gateway keys, assistant
// API key). Uses AES-256-GCM with a key derived from SETTINGS_ENCRYPTION_KEY
// (falls back to JWT_SECRET). Ciphertext format: enc:v1:<iv>:<tag>:<data> (b64).
const PREFIX = 'enc:v1:';

function key(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'hostagente-dev-key';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value || '';
  try {
    const [, , ivB64, tagB64, dataB64] = value.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function isEncrypted(value?: string): boolean {
  return !!value && value.startsWith(PREFIX);
}
