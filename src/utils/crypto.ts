import { Note, Folder } from '../types';

export interface VaultPayload {
  notes: Note[];
  folders: Folder[];
  linkFolderMap: Record<string, string>;
  lastActiveNoteId?: string | null;
  updatedAt: number;
}

export interface VaultMeta {
  version: 1;
  salt: string; // Base64 16 bytes
  verifier: string; // Base64 ciphertext of verification canary
  verifierIv: string; // Base64 12 bytes
  autoLockMinutes: number; // Default 15
  createdAt: number;
}

export interface EncryptedDataBundle {
  version: 1;
  salt: string; // Base64 16 bytes
  iv: string; // Base64 12 bytes
  ciphertext: string; // Base64 ciphertext
}

const CANARY_PHRASE = 'MINIMAL_NOTES_VAULT_CANARY_V1_OK';
const PBKDF2_ITERATIONS = 100000;

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a 256-bit AES-GCM key from password and salt using PBKDF2 with 100,000 iterations of SHA-256.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a text string with AES-256-GCM
 */
export async function encryptText(text: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encodedData = enc.encode(text);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    key,
    encodedData
  );

  const bundle: EncryptedDataBundle = {
    version: 1,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };

  return JSON.stringify(bundle);
}

/**
 * Decrypt an AES-256-GCM encrypted bundle string back to plain text
 */
export async function decryptText(encryptedJsonStr: string, password: string): Promise<string> {
  const bundle: EncryptedDataBundle = JSON.parse(encryptedJsonStr);
  const salt = base64ToUint8Array(bundle.salt);
  const iv = base64ToUint8Array(bundle.iv);
  const ciphertext = base64ToUint8Array(bundle.ciphertext);

  const key = await deriveKey(password, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Create a VaultMeta descriptor containing a verification canary to quickly validate password
 */
export async function createVaultMeta(password: string, autoLockMinutes: number = 15): Promise<VaultMeta> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const canaryBytes = enc.encode(CANARY_PHRASE);
  const verifierBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    key,
    canaryBytes
  );

  return {
    version: 1,
    salt: arrayBufferToBase64(salt),
    verifier: arrayBufferToBase64(verifierBuffer),
    verifierIv: arrayBufferToBase64(iv),
    autoLockMinutes,
    createdAt: Date.now(),
  };
}

/**
 * Verify if the entered password matches the stored vault metadata
 */
export async function verifyVaultPassword(password: string, meta: VaultMeta): Promise<boolean> {
  try {
    const salt = base64ToUint8Array(meta.salt);
    const iv = base64ToUint8Array(meta.verifierIv);
    const verifierCiphertext = base64ToUint8Array(meta.verifier);

    const key = await deriveKey(password, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      verifierCiphertext
    );

    const dec = new TextDecoder();
    const result = dec.decode(decryptedBuffer);
    return result === CANARY_PHRASE;
  } catch {
    return false;
  }
}

/**
 * Encrypt the full vault payload (notes, folders, map) with AES-256-GCM
 */
export async function encryptVaultPayload(payload: VaultPayload, password: string): Promise<string> {
  const json = JSON.stringify(payload);
  return encryptText(json, password);
}

/**
 * Decrypt the full vault payload with the master password
 */
export async function decryptVaultPayload(encryptedBundleStr: string, password: string): Promise<VaultPayload> {
  const json = await decryptText(encryptedBundleStr, password);
  return JSON.parse(json) as VaultPayload;
}
