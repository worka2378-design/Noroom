import { Note, Folder } from '../types';
import { VaultMeta } from './crypto';

export const STORAGE_KEY = 'minimal-notes-v2';
export const SIDEBAR_STATE_KEY = 'minimal-notes-sidebar';
export const FOLDERS_STORAGE_KEY = 'minimal-notes-folders-v1';
export const LINK_FOLDERS_STORAGE_KEY = 'minimal-notes-link-folders-v1';
export const VAULT_META_KEY = 'minimal-notes-vault-meta-v1';
export const VAULT_DATA_KEY = 'minimal-notes-vault-data-v1';

export function uid(): string {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function formatNoteDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (sameDay) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function extractPlainSnippet(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').trim().slice(0, 90);
}

export function countWords(html: string): number {
  if (!html) return 0;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const txt = (tmp.textContent || '').trim();
  return txt ? txt.split(/\s+/).length : 0;
}

export function countCharacters(html: string): number {
  if (!html) return 0;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').length;
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const pa = a.pinned ? 1 : 0;
    const pb = b.pinned ? 1 : 0;
    if (pb !== pa) return pb - pa;
    return (b.updated || 0) - (a.updated || 0);
  });
}

export const INITIAL_NOTES: Note[] = [
  {
    id: 'welcome-note-uk',
    title: 'Ласкаво просимо до Нотаток',
    content: `<h1>Ласкаво просимо!</h1>
<p>Це ваш чистий та мінімалістичний простір для думок, списків, ідей та щоденних записів.</p>
<h2>✨ Основні можливості</h2>
<ul>
  <li><b>Багате форматування:</b> заголовки, списки, цитати, виділення кольором та маркером.</li>
  <li><b>Розумні графічні посилання:</b> вставляйте або друкуйте будь-які лінки (наприклад, <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="rich-link" data-url="https://github.com"><img src="https://www.google.com/s2/favicons?domain=github.com&sz=64" alt="" class="rich-link-icon" /><span>github.com</span></a> або <a href="https://uk.wikipedia.org" target="_blank" rel="noopener noreferrer" class="rich-link" data-url="https://uk.wikipedia.org"><img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64" alt="" class="rich-link-icon" /><span>uk.wikipedia.org</span></a>) — вони автоматично перетворюються на графічні бейджі з іконкою сайту.</li>
  <li><b>Швидка організація:</b> закріплюйте важливе вгорі (📌), маркуйте ключове (●), дублюйте нотатки.</li>
</ul>
<blockquote><i>«Простота — це необхідна умова витонченості.»</i></blockquote>
<p>Спробуйте натиснути логотип ліворуч зверху, щоб згорнути бічну панель у режим повного фокусування на письмі.</p>`,
    created: Date.now() - 3600000,
    updated: Date.now(),
    pinned: true,
    marked: false,
  },
  {
    id: 'resources-note-uk',
    title: 'Корисні ресурси та закладки',
    content: `<h2>🔗 Збережені веб-ресурси</h2>
<p>Ось корисні посилання для швидкого доступу:</p>
<p><a href="https://google.com" target="_blank" rel="noopener noreferrer" class="rich-link" data-url="https://google.com"><img src="https://www.google.com/s2/favicons?domain=google.com&sz=64" alt="" class="rich-link-icon" /><span>google.com</span></a> — пошукова система</p>
<p><a href="https://developer.mozilla.org" target="_blank" rel="noopener noreferrer" class="rich-link" data-url="https://developer.mozilla.org"><img src="https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=64" alt="" class="rich-link-icon" /><span>developer.mozilla.org</span></a> — документація веброзробки</p>
<p><a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" class="rich-link" data-url="https://unsplash.com"><img src="https://www.google.com/s2/favicons?domain=unsplash.com&sz=64" alt="" class="rich-link-icon" /><span>unsplash.com</span></a> — безкоштовні фотографії високої якості</p>`,
    created: Date.now() - 43200000,
    updated: Date.now() - 1800000,
    pinned: false,
    marked: false,
  },
  {
    id: 'ideas-note-uk',
    title: 'Ідеї та плани на тиждень',
    content: `<h2>🎯 Пріоритетні завдання</h2>
<ol>
  <li>Сформувати структуру нового проєкту</li>
  <li>Підготувати макети інтерфейсу</li>
  <li>Провести рев'ю коду та оптимізацію швидкодії</li>
</ol>
<pre>// Приклад швидкої нотатки коду
const focusMode = true;
if (focusMode) {
  startDeepWorkSession();
}</pre>`,
    created: Date.now() - 86400000,
    updated: Date.now() - 7200000,
    pinned: false,
    marked: true,
  }
];

// In-memory fallback in case localStorage is disabled, blocked in private mode, or full
const memoryStore = new Map<string, string>();

export function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch (e) {
    console.warn(`[Storage] Unable to access localStorage for "${key}":`, e);
  }
  return memoryStore.get(key) ?? null;
}

export function safeSetItem(key: string, value: string): boolean {
  // Always update in-memory cache
  memoryStore.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return true;
    }
  } catch (e) {
    console.warn(`[Storage] Unable to save "${key}" to localStorage (quota or privacy restriction):`, e);
  }
  return false;
}

export function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`[Storage] Unable to remove "${key}" from localStorage:`, e);
  }
}

export function loadSavedNotes(): Note[] {
  try {
    const raw = safeGetItem(STORAGE_KEY);
    if (!raw) return INITIAL_NOTES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sortNotes(
        parsed.map((n) => ({
          ...n,
          pinned: !!n.pinned,
          marked: !!n.marked,
        }))
      );
    }
    return INITIAL_NOTES;
  } catch (e) {
    console.error('[Storage] Error loading notes:', e);
    return INITIAL_NOTES;
  }
}

export function saveNotesToStorage(notes: Note[]): void {
  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('[Storage] Error serializing notes:', e);
  }
}

export const INITIAL_FOLDERS: Folder[] = [
  {
    id: 'folder-work',
    name: 'Робота та проєкти',
    type: 'notes',
    collapsed: false,
  },
  {
    id: 'folder-links-dev',
    name: 'Розробка та сервіси',
    type: 'links',
    collapsed: false,
  },
];

export function loadSavedFolders(): Folder[] {
  try {
    const raw = safeGetItem(FOLDERS_STORAGE_KEY);
    if (!raw) return INITIAL_FOLDERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_FOLDERS;
  } catch (e) {
    console.error('[Storage] Error loading folders:', e);
    return INITIAL_FOLDERS;
  }
}

export function saveFoldersToStorage(folders: Folder[]): void {
  try {
    safeSetItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (e) {
    console.error('[Storage] Error serializing folders:', e);
  }
}

export function loadSavedLinkFolderMap(): Record<string, string> {
  try {
    const raw = safeGetItem(LINK_FOLDERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch (e) {
    console.error('[Storage] Error loading link folders:', e);
    return {};
  }
}

export function saveLinkFolderMapToStorage(map: Record<string, string>): void {
  try {
    safeSetItem(LINK_FOLDERS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('[Storage] Error serializing link folders:', e);
  }
}

/**
 * Pure function to calculate a Set containing rootFolderId and all its recursive sub-folder IDs.
 */
export function getFolderAndSubfolderIds(rootFolderId: string, allFolders: Folder[]): Set<string> {
  const result = new Set<string>([rootFolderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of allFolders) {
      if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
        result.add(f.id);
        changed = true;
      }
    }
  }
  return result;
}

export function isVaultProtected(): boolean {
  return !!safeGetItem(VAULT_META_KEY);
}

export function getSavedVaultMeta(): VaultMeta | null {
  try {
    const raw = safeGetItem(VAULT_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VaultMeta;
  } catch (e) {
    console.error('[Storage] Error loading vault meta:', e);
    return null;
  }
}

export function saveVaultMeta(meta: VaultMeta): void {
  safeSetItem(VAULT_META_KEY, JSON.stringify(meta));
}

export function getSavedEncryptedVaultData(): string | null {
  return safeGetItem(VAULT_DATA_KEY);
}

export function saveEncryptedVaultData(ciphertext: string): void {
  safeSetItem(VAULT_DATA_KEY, ciphertext);
}

export function clearPlainStorage(): void {
  safeRemoveItem(STORAGE_KEY);
  safeRemoveItem(FOLDERS_STORAGE_KEY);
  safeRemoveItem(LINK_FOLDERS_STORAGE_KEY);
}

export function resetEntireVault(): void {
  safeRemoveItem(VAULT_META_KEY);
  safeRemoveItem(VAULT_DATA_KEY);
  clearPlainStorage();
}


