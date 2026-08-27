import { Note, Folder } from '../types';
import {
  VaultMeta,
  VaultPayload,
  encryptVaultPayload,
  encryptText,
  decryptVaultPayload,
} from './crypto';

const DB_NAME = 'minimal_notes_fs_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'local_folder_handle';
const SETTINGS_KEY = 'minimal_notes_sync_settings';

export interface SyncSettings {
  enabled: boolean;
  folderName: string | null;
  lastSyncTimestamp: number | null;
}

/**
 * Open IndexedDB to persist FileSystemDirectoryHandle
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save directory handle to IndexedDB
 */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get saved directory handle from IndexedDB
 */
export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[FileSync] Could not read directory handle from IndexedDB:', err);
    return null;
  }
}

/**
 * Remove directory handle from IndexedDB
 */
export async function removeSavedDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[FileSync] Could not remove directory handle:', err);
  }
}

/**
 * Load sync settings from localStorage
 */
export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: !!parsed.enabled,
        folderName: parsed.folderName || null,
        lastSyncTimestamp: parsed.lastSyncTimestamp || null,
      };
    }
  } catch (e) {
    console.warn('[FileSync] Error reading sync settings:', e);
  }
  return {
    enabled: false,
    folderName: null,
    lastSyncTimestamp: null,
  };
}

/**
 * Save sync settings to localStorage
 */
export function saveSyncSettings(settings: SyncSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[FileSync] Error saving sync settings:', e);
  }
}

/**
 * Check if the app is running inside an iframe
 */
export function isInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Check if File System Access API is supported in the current browser
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Verify permission for directory handle
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite: boolean = true
): Promise<boolean> {
  const options = {
    mode: (readWrite ? 'readwrite' : 'read') as 'readwrite' | 'read',
  };
  try {
    if ((await (handle as any).queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await (handle as any).requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (e) {
    console.warn('[FileSync] Permission verification error:', e);
  }
  return false;
}

export class IframePermissionError extends Error {
  isIframeError = true;
  constructor(message = 'Браузер блокує вибір папок у вікні попереднього перегляду (iframe). Відкрийте сайт у новій вкладці.') {
    super(message);
    this.name = 'IframePermissionError';
  }
}

/**
 * Ask user to pick a folder on their PC
 */
export async function pickLocalFolder(): Promise<{
  handle: FileSystemDirectoryHandle;
  folderName: string;
} | null> {
  if (isInsideIframe()) {
    throw new IframePermissionError();
  }

  if (!isFileSystemAccessSupported()) {
    throw new Error('Ваш браузер не підтримує прямий доступ до файлової системи (потрібен Chrome, Edge або Opera).');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    const hasPermission = await verifyPermission(handle, true);
    if (!hasPermission) {
      throw new Error('Не надано дозвіл на запис у вибрану папку.');
    }

    await saveDirectoryHandle(handle);
    const folderName = handle.name || 'Обрана папка';

    const currentSettings = loadSyncSettings();
    saveSyncSettings({
      ...currentSettings,
      enabled: true,
      folderName,
      lastSyncTimestamp: Date.now(),
    });

    return { handle, folderName };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return null; // User cancelled picker
    }
    if (
      err.name === 'SecurityError' ||
      /cross.?origin|sub.?frame/i.test(err.message || '')
    ) {
      throw new IframePermissionError();
    }
    throw err;
  }
}

/**
 * Write encrypted notes, folders, and vault metadata directly to the local folder
 */
export async function syncVaultToLocalFolder(
  handle: FileSystemDirectoryHandle,
  notes: Note[],
  folders: Folder[],
  linkFolderMap: Record<string, string>,
  vaultMeta: VaultMeta,
  masterPassword: string
): Promise<{ success: boolean; timestamp: number }> {
  const hasPermission = await verifyPermission(handle, true);
  if (!hasPermission) {
    throw new Error('Немає дозволу на запис у папку на ПК.');
  }

  const timestamp = Date.now();

  // 1. Write vault-meta.json (canary verifier and crypto parameters)
  const metaHandle = await handle.getFileHandle('vault-meta.json', { create: true });
  const metaWritable = await (metaHandle as any).createWritable();
  await metaWritable.write(JSON.stringify(vaultMeta, null, 2));
  await metaWritable.close();

  // 2. Write master encrypted bundle: vault.vault
  const payload: VaultPayload = {
    notes,
    folders,
    linkFolderMap,
    updatedAt: timestamp,
  };
  const masterCiphertext = await encryptVaultPayload(payload, masterPassword);
  const bundleHandle = await handle.getFileHandle('vault.vault', { create: true });
  const bundleWritable = await (bundleHandle as any).createWritable();
  await bundleWritable.write(masterCiphertext);
  await bundleWritable.close();

  // 3. Create 'encrypted_notes' subfolder and save each note as an encrypted .vault file
  const notesDirHandle = await handle.getDirectoryHandle('encrypted_notes', { create: true });

  // Save each note individually in encrypted format
  for (const note of notes) {
    const noteJson = JSON.stringify(note);
    const encryptedNote = await encryptText(noteJson, masterPassword);
    // Sanitize note file name
    const safeTitle = (note.title || 'untitled')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .slice(0, 40)
      .trim();
    const fileName = `${safeTitle || 'note'}_${note.id.slice(0, 8)}.vault`;
    const noteFileHandle = await notesDirHandle.getFileHandle(fileName, { create: true });
    const noteWritable = await (noteFileHandle as any).createWritable();
    await noteWritable.write(encryptedNote);
    await noteWritable.close();
  }

  // 4. Write a README info file inside the folder so user understands why files are encrypted
  try {
    const readmeHandle = await handle.getFileHandle('README_SECURITY.txt', { create: true });
    const readmeWritable = await (readmeHandle as any).createWritable();
    const infoText = `=== ЗАХИЩЕНЕ СХОВИЩЕ НОТАТОК (AES-256-GCM) ===
Усі файли у цій папці надійно зашифровані вашим мастер-паролем.
Жодна людина чи стороння програма не може прочитати вміст без введення пароля на сайті.

Останнє автозбереження: ${new Date(timestamp).toLocaleString('uk-UA')}
Кількість нотаток: ${notes.length}
`;
    await readmeWritable.write(infoText);
    await readmeWritable.close();
  } catch {
    // Non-critical
  }

  // Update sync timestamp in settings
  const settings = loadSyncSettings();
  saveSyncSettings({
    ...settings,
    lastSyncTimestamp: timestamp,
  });

  return { success: true, timestamp };
}

/**
 * Restore vault from a chosen local folder
 */
export async function restoreFromLocalFolder(
  handle: FileSystemDirectoryHandle,
  masterPassword: string
): Promise<{
  vaultMeta: VaultMeta;
  payload: VaultPayload;
}> {
  const hasPermission = await verifyPermission(handle, false);
  if (!hasPermission) {
    throw new Error('Немає дозволу на читання папки.');
  }

  // 1. Read vault-meta.json
  const metaHandle = await handle.getFileHandle('vault-meta.json');
  const metaFile = await metaHandle.getFile();
  const metaText = await metaFile.text();
  const vaultMeta = JSON.parse(metaText) as VaultMeta;

  // 2. Read vault.vault
  const bundleHandle = await handle.getFileHandle('vault.vault');
  const bundleFile = await bundleHandle.getFile();
  const bundleCiphertext = await bundleFile.text();

  // 3. Decrypt payload
  const payload = await decryptVaultPayload(bundleCiphertext, masterPassword);

  return { vaultMeta, payload };
}
