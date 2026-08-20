/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, X, FolderPlus, FileText, Link2, Plus, Lock, Unlock } from 'lucide-react';
import { Note, Folder } from './types';
import {
  loadSavedNotes,
  saveNotesToStorage,
  loadSavedFolders,
  saveFoldersToStorage,
  loadSavedLinkFolderMap,
  saveLinkFolderMapToStorage,
  sortNotes,
  uid,
  SIDEBAR_STATE_KEY,
  safeGetItem,
  safeSetItem,
  getFolderAndSubfolderIds,
  isVaultProtected,
  getSavedVaultMeta,
  saveVaultMeta,
  getSavedEncryptedVaultData,
  saveEncryptedVaultData,
  clearPlainStorage,
  resetEntireVault,
  INITIAL_NOTES,
  INITIAL_FOLDERS,
} from './utils/storage';
import {
  VaultMeta,
  VaultPayload,
  createVaultMeta,
  verifyVaultPassword,
  encryptVaultPayload,
  decryptVaultPayload,
} from './utils/crypto';
import {
  createGraphicLinkHtml,
  extractAllLinksFromNotes,
  removeLinkFromContent,
  ExtractedLink,
} from './utils/links';
import { syncAutoFolders } from './utils/autoFolders';
import { Sidebar, SidebarHandle } from './components/Sidebar';
import { EditorPane, EditorPaneHandle } from './components/EditorPane';
import { EditorToolbar } from './components/EditorToolbar';
import { LinkModal } from './components/LinkModal';
import { LogoIcon } from './components/LogoIcon';
import { VaultLockScreen } from './components/VaultLockScreen';
import { VaultSetupModal } from './components/VaultSetupModal';

export default function App() {
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(() => getSavedVaultMeta());
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(() => isVaultProtected());
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isVaultSetupOpen, setIsVaultSetupOpen] = useState(false);

  const [notes, setNotes] = useState<Note[]>(() => (isVaultProtected() ? [] : loadSavedNotes()));
  const [folders, setFolders] = useState<Folder[]>(() => (isVaultProtected() ? [] : loadSavedFolders()));
  const [linkFolderMap, setLinkFolderMap] = useState<Record<string, string>>(() =>
    isVaultProtected() ? {} : loadSavedLinkFolderMap()
  );
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (isVaultProtected()) return null;
    const initial = loadSavedNotes();
    return initial.length > 0 ? initial[0].id : null;
  });
  const [targetAnchorId, setTargetAnchorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'notes' | 'links'>('notes');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return safeGetItem(SIDEBAR_STATE_KEY) === 'collapsed';
  });

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [textColor, setTextColor] = useState('#1b1c1e');
  const [highlightColor, setHighlightColor] = useState('#fef08a');

  // Typing state for auto-collapsing secondary toolbar tools and sidebar
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEditorTyping = useCallback(() => {
    setIsTyping(true);

    // Auto-collapse layers/sidebar panel when editing text
    setIsSidebarCollapsed((prev) => {
      if (!prev) {
        safeSetItem(SIDEBAR_STATE_KEY, 'collapsed');
        return true;
      }
      return prev;
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1800);
  }, []);

  const sidebarRef = useRef<SidebarHandle>(null);
  const editorPaneRef = useRef<EditorPaneHandle>(null);

  // Debounced storage save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Unified save engine (Encrypted AES-GCM when vault is active, otherwise local storage)
  const persistVaultData = useCallback(
    (
      currentNotes: Note[],
      currentFolders: Folder[],
      currentMap: Record<string, string>,
      currentActiveId: string | null
    ) => {
      if (vaultMeta && masterPassword) {
        const payload: VaultPayload = {
          notes: currentNotes,
          folders: currentFolders,
          linkFolderMap: currentMap,
          lastActiveNoteId: currentActiveId,
          updatedAt: Date.now(),
        };
        encryptVaultPayload(payload, masterPassword)
          .then((ciphertext) => {
            saveEncryptedVaultData(ciphertext);
          })
          .catch((err) => {
            console.error('Failed to encrypt vault:', err);
          });
      } else if (!vaultMeta) {
        saveNotesToStorage(currentNotes);
        saveFoldersToStorage(currentFolders);
        saveLinkFolderMapToStorage(currentMap);
      }
    },
    [vaultMeta, masterPassword]
  );

  const persistNotes = useCallback(
    (updatedNotes: Note[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        persistVaultData(updatedNotes, folders, linkFolderMap, activeId);
      }, 200);
    },
    [activeId, folders, linkFolderMap, persistVaultData]
  );

  const persistFolders = useCallback(
    (updatedFolders: Folder[]) => {
      persistVaultData(notes, updatedFolders, linkFolderMap, activeId);
    },
    [activeId, linkFolderMap, notes, persistVaultData]
  );

  const persistLinkFolderMap = useCallback(
    (updatedMap: Record<string, string>) => {
      persistVaultData(notes, folders, updatedMap, activeId);
    },
    [activeId, folders, notes, persistVaultData]
  );

  // Lock Vault handler
  const handleLockVault = useCallback(() => {
    setMasterPassword(null);
    setIsVaultLocked(true);
    // Erase sensitive decrypted data from in-memory react state
    setNotes([]);
    setFolders([]);
    setLinkFolderMap({});
    setActiveId(null);
  }, []);

  // Unlock Vault handler
  const handleUnlockVault = useCallback(async (password: string): Promise<boolean> => {
    try {
      const ciphertext = getSavedEncryptedVaultData();
      if (!ciphertext) {
        // Empty vault
        setNotes(INITIAL_NOTES);
        setFolders(INITIAL_FOLDERS);
        setLinkFolderMap({});
        setActiveId(INITIAL_NOTES[0].id);
        setMasterPassword(password);
        setIsVaultLocked(false);
        return true;
      }

      const payload = await decryptVaultPayload(ciphertext, password);
      setNotes(sortNotes(payload.notes || []));
      setFolders(payload.folders || []);
      setLinkFolderMap(payload.linkFolderMap || {});
      setActiveId(payload.lastActiveNoteId || (payload.notes?.[0]?.id ?? null));
      setMasterPassword(password);
      setIsVaultLocked(false);
      return true;
    } catch (err) {
      console.error('Failed to unlock vault:', err);
      return false;
    }
  }, []);

  // Reset entire vault
  const handleResetVault = useCallback(() => {
    resetEntireVault();
    setVaultMeta(null);
    setMasterPassword(null);
    setIsVaultLocked(false);
    setNotes(INITIAL_NOTES);
    setFolders(INITIAL_FOLDERS);
    setLinkFolderMap({});
    setActiveId(INITIAL_NOTES[0].id);
  }, []);

  // Setup Vault for first time
  const handleSetupVault = useCallback(
    async (password: string, autoLockMinutes: number): Promise<boolean> => {
      try {
        const meta = await createVaultMeta(password, autoLockMinutes);
        const payload: VaultPayload = {
          notes,
          folders,
          linkFolderMap,
          lastActiveNoteId: activeId,
          updatedAt: Date.now(),
        };
        const ciphertext = await encryptVaultPayload(payload, password);
        saveVaultMeta(meta);
        saveEncryptedVaultData(ciphertext);
        clearPlainStorage(); // Purge unencrypted data from disk!

        setVaultMeta(meta);
        setMasterPassword(password);
        setIsVaultLocked(false);
        return true;
      } catch (err) {
        console.error('Setup vault error:', err);
        return false;
      }
    },
    [activeId, folders, linkFolderMap, notes]
  );

  // Change master password
  const handleChangePassword = useCallback(
    async (oldPassword: string, newPassword: string, autoLockMinutes?: number): Promise<boolean> => {
      if (!vaultMeta) return false;
      const isValid = await verifyVaultPassword(oldPassword, vaultMeta);
      if (!isValid) return false;

      try {
        const lockMinutes = autoLockMinutes ?? vaultMeta.autoLockMinutes ?? 15;
        const meta = await createVaultMeta(newPassword, lockMinutes);
        const payload: VaultPayload = {
          notes,
          folders,
          linkFolderMap,
          lastActiveNoteId: activeId,
          updatedAt: Date.now(),
        };
        const ciphertext = await encryptVaultPayload(payload, newPassword);
        saveVaultMeta(meta);
        saveEncryptedVaultData(ciphertext);

        setVaultMeta(meta);
        setMasterPassword(newPassword);
        return true;
      } catch (err) {
        console.error('Change password error:', err);
        return false;
      }
    },
    [activeId, folders, linkFolderMap, notes, vaultMeta]
  );

  // Update auto-lock duration without requiring password change
  const handleUpdateAutoLockMinutes = useCallback(
    (newMinutes: number) => {
      if (!vaultMeta) return;
      const updatedMeta: VaultMeta = {
        ...vaultMeta,
        autoLockMinutes: newMinutes,
      };
      saveVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);
    },
    [vaultMeta]
  );

  // Disable vault encryption (convert back to regular local storage)
  const handleDisableVault = useCallback(
    async (currentPassword: string): Promise<boolean> => {
      if (!vaultMeta) return false;
      const isValid = await verifyVaultPassword(currentPassword, vaultMeta);
      if (!isValid) return false;

      try {
        saveNotesToStorage(notes);
        saveFoldersToStorage(folders);
        saveLinkFolderMapToStorage(linkFolderMap);
        resetEntireVault();
        // Re-save plain text
        saveNotesToStorage(notes);
        saveFoldersToStorage(folders);
        saveLinkFolderMapToStorage(linkFolderMap);

        setVaultMeta(null);
        setMasterPassword(null);
        setIsVaultLocked(false);
        return true;
      } catch (err) {
        console.error('Disable vault error:', err);
        return false;
      }
    },
    [folders, linkFolderMap, notes, vaultMeta]
  );

  // Export encrypted backup
  const handleExportBackup = useCallback(() => {
    if (!vaultMeta) return;
    const ciphertext = getSavedEncryptedVaultData();
    const backupObj = {
      app: 'MinimalNotesEncryptedVault',
      version: 1,
      meta: vaultMeta,
      data: ciphertext,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-vault-backup-${new Date().toISOString().slice(0, 10)}.vault`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vaultMeta]);

  // Auto-lock timer on user inactivity
  useEffect(() => {
    if (isVaultLocked || !vaultMeta || !vaultMeta.autoLockMinutes || vaultMeta.autoLockMinutes <= 0 || !masterPassword) {
      return;
    }

    const timeoutMs = vaultMeta.autoLockMinutes * 60 * 1000;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLockVault();
      }, timeoutMs);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [isVaultLocked, vaultMeta, masterPassword, handleLockVault]);

  // Compute all extracted links across all notes
  const extractedLinks = useMemo(() => {
    return extractAllLinksFromNotes(notes);
  }, [notes]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      safeSetItem(SIDEBAR_STATE_KEY, next ? 'collapsed' : 'expanded');
      return next;
    });
  };

  const handleToggleViewMode = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      safeSetItem(SIDEBAR_STATE_KEY, 'expanded');
    }
    setViewMode((prev) => (prev === 'links' ? 'notes' : 'links'));
  };

  // Auto-sync folders and sub-folders based on links and headings in notes
  useEffect(() => {
    if (isVaultLocked) return;
    const result = syncAutoFolders(notes, folders, linkFolderMap);
    if (result.hasChanges) {
      setFolders(result.updatedFolders);
      setLinkFolderMap(result.updatedLinkFolderMap);
      persistFolders(result.updatedFolders);
      persistLinkFolderMap(result.updatedLinkFolderMap);
    }
  }, [notes, folders, linkFolderMap, persistFolders, persistLinkFolderMap, isVaultLocked]);

  // Folder Operations
  const handleAddFolder = useCallback(
    (type: 'notes' | 'links', parentId?: string | null): string => {
      const newId = 'f-' + uid();
      const newFolder: Folder = {
        id: newId,
        name: parentId
          ? 'Нова під-папка'
          : type === 'notes'
          ? 'Нова папка'
          : 'Папка посилань',
        type,
        parentId: parentId || null,
        collapsed: false,
        interacted: true,
      };

      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === parentId ? { ...f, collapsed: false, interacted: true } : f
        );
        const updated = [...next, newFolder];
        persistFolders(updated);
        return updated;
      });

      return newId;
    },
    [persistFolders]
  );

  const handleMoveFolderToFolder = useCallback(
    (sourceFolderId: string, targetParentId: string | null) => {
      if (sourceFolderId === targetParentId) return;

      setFolders((prev) => {
        // Circular reference prevention: ensure targetParentId is not a descendant of sourceFolderId
        if (targetParentId) {
          let curr = prev.find((f) => f.id === targetParentId);
          while (curr) {
            if (curr.id === sourceFolderId) {
              return prev; // Cannot move parent into its own child/descendant
            }
            curr = curr.parentId ? prev.find((f) => f.id === curr!.parentId) : undefined;
          }
        }

        const next = prev.map((f) => {
          if (f.id === sourceFolderId) {
            return { ...f, parentId: targetParentId, interacted: true };
          }
          if (targetParentId && f.id === targetParentId) {
            return { ...f, collapsed: false, interacted: true };
          }
          return f;
        });

        persistFolders(next);
        return next;
      });
    },
    [persistFolders]
  );

  const handleMarkFolderInteracted = useCallback(
    (folderId: string) => {
      setFolders((prev) => {
        const folder = prev.find((f) => f.id === folderId);
        if (!folder || folder.interacted) return prev;
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, interacted: true } : f
        );
        persistFolders(next);
        return next;
      });
    },
    [persistFolders]
  );

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, collapsed: !f.collapsed, interacted: true } : f
        );
        persistFolders(next);
        return next;
      });
    },
    [persistFolders]
  );

  const handleRenameFolder = useCallback(
    (folderId: string, newName: string) => {
      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, name: newName, interacted: true } : f
        );
        persistFolders(next);
        return next;
      });
    },
    [persistFolders]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      if (!window.confirm('Видалити цю папку та її під-папки? (Вміст залишиться у списку)')) return;

      const idsToDelete = getFolderAndSubfolderIds(folderId, folders);

      setFolders((prev) => {
        const next = prev.filter((f) => !idsToDelete.has(f.id));
        persistFolders(next);
        return next;
      });

      // Clear folderId from notes in deleted folders
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.folderId && idsToDelete.has(n.folderId) ? { ...n, folderId: null } : n
        );
        persistNotes(updated);
        return updated;
      });

      // Clear links from linkFolderMap
      setLinkFolderMap((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((k) => {
          if (idsToDelete.has(updated[k])) {
            delete updated[k];
          }
        });
        persistLinkFolderMap(updated);
        return updated;
      });
    },
    [folders, persistFolders, persistNotes, persistLinkFolderMap]
  );

  const handleMoveNoteToFolder = useCallback(
    (noteId: string, folderId: string | null) => {
      if (folderId) {
        setFolders((prev) => {
          const next = prev.map((f) =>
            f.id === folderId ? { ...f, interacted: true } : f
          );
          persistFolders(next);
          return next;
        });
      }
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.id === noteId ? { ...n, folderId, updated: Date.now() } : n
        );
        persistNotes(updated);
        return updated;
      });
    },
    [persistFolders, persistNotes]
  );

  const handleMoveLinkToFolder = useCallback(
    (linkId: string, folderId: string | null) => {
      if (folderId) {
        setFolders((prev) => {
          const next = prev.map((f) =>
            f.id === folderId ? { ...f, interacted: true } : f
          );
          persistFolders(next);
          return next;
        });
      }
      setLinkFolderMap((prev) => {
        const updated = { ...prev };
        if (folderId) {
          updated[linkId] = folderId;
        } else {
          delete updated[linkId];
        }
        persistLinkFolderMap(updated);
        return updated;
      });
    },
    [persistFolders, persistLinkFolderMap]
  );

  const handleCreateNote = useCallback(() => {
    const newNote: Note = {
      id: uid(),
      title: '',
      content: '',
      created: Date.now(),
      updated: Date.now(),
      pinned: false,
      marked: false,
      folderId: null,
    };

    setNotes((prev) => {
      const updated = sortNotes([newNote, ...prev]);
      persistNotes(updated);
      return updated;
    });
    setActiveId(newNote.id);
    setViewMode('notes');

    // If sidebar is collapsed on small screen, keep focus on editor
    setTimeout(() => {
      const input = document.getElementById('editor-title-input') as HTMLInputElement | null;
      if (input) {
        input.focus();
      }
    }, 50);
  }, [persistNotes]);

  const handleUpdateActiveNote = useCallback(
    (updates: Partial<Note>) => {
      if (!activeId) return;

      setNotes((prev) => {
        const index = prev.findIndex((n) => n.id === activeId);
        if (index === -1) return prev;

        const updatedNote: Note = {
          ...prev[index],
          ...updates,
          updated: Date.now(),
        };

        const updatedList = [...prev];
        updatedList[index] = updatedNote;
        const sorted = sortNotes(updatedList);
        persistNotes(sorted);
        return sorted;
      });
    },
    [activeId, persistNotes]
  );

  const handleSelectNote = useCallback((id: string, anchorId?: string | null) => {
    setActiveId(id);
    setTargetAnchorId(anchorId || null);
  }, []);

  const handleNavigateToNote = useCallback((noteId: string, anchorId?: string | null) => {
    setActiveId(noteId);
    setTargetAnchorId(anchorId || null);
    setViewMode('notes');
  }, []);

  const handleDeleteLink = useCallback(
    (link: ExtractedLink) => {
      setNotes((prev) => {
        const targetNote = prev.find((n) => n.id === link.noteId);
        if (!targetNote) return prev;

        const updatedContent = removeLinkFromContent(targetNote.content, link.url);
        const updatedList = prev.map((n) =>
          n.id === link.noteId ? { ...n, content: updatedContent, updated: Date.now() } : n
        );
        persistNotes(updatedList);
        return updatedList;
      });
    },
    [persistNotes]
  );

  const handleCopyNote = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const original = notes.find((n) => n.id === id);
      if (!original) return;

      const duplicated: Note = {
        ...original,
        id: uid(),
        title: original.title ? `${original.title} — копія` : 'Копія',
        created: Date.now(),
        updated: Date.now(),
        pinned: false,
        marked: false,
      };

      setNotes((prev) => {
        const updated = sortNotes([duplicated, ...prev]);
        persistNotes(updated);
        return updated;
      });
      setActiveId(duplicated.id);
    },
    [notes, persistNotes]
  );

  const handleTogglePin = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, pinned: !n.pinned, updated: Date.now() } : n
        );
        const sorted = sortNotes(updated);
        persistNotes(sorted);
        return sorted;
      });
    },
    [persistNotes]
  );

  const handleToggleMarked = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setNotes((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, marked: !n.marked } : n));
        persistNotes(updated);
        return updated;
      });
    },
    [persistNotes]
  );

  const handleDeleteNote = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm('Видалити цю нотатку?')) return;

      // 1. Identify all folders created for or associated with this note
      const noteFolderIdsToDelete = new Set<string>();
      folders.forEach((f) => {
        if (
          f.sourceNoteId === id ||
          f.id === `auto-f-${id}` ||
          f.id.startsWith(`auto-sf-${id}-`) ||
          f.id.startsWith(`auto-f-${id}`)
        ) {
          noteFolderIdsToDelete.add(f.id);
        }
      });

      // Also get all recursive sub-folders of these folders
      const allFolderIdsToDelete = new Set<string>();
      noteFolderIdsToDelete.forEach((fId) => {
        const subIds = getFolderAndSubfolderIds(fId, folders);
        subIds.forEach((sId) => allFolderIdsToDelete.add(sId));
      });

      // 2. Remove associated folders and persist
      if (allFolderIdsToDelete.size > 0) {
        setFolders((prevFolders) => {
          const nextFolders = prevFolders.filter((f) => !allFolderIdsToDelete.has(f.id));
          persistFolders(nextFolders);
          return nextFolders;
        });
      }

      // 3. Clean up linkFolderMap for links belonging to this note or pointing to deleted folders
      setLinkFolderMap((prevMap) => {
        const nextMap = { ...prevMap };
        let mapChanged = false;
        Object.keys(nextMap).forEach((linkKey) => {
          if (linkKey.startsWith(`${id}-`) || allFolderIdsToDelete.has(nextMap[linkKey])) {
            delete nextMap[linkKey];
            mapChanged = true;
          }
        });
        if (mapChanged) {
          persistLinkFolderMap(nextMap);
        }
        return nextMap;
      });

      // 4. Filter notes and update active note
      setNotes((prev) => {
        const filtered = prev.filter((n) => n.id !== id);
        persistNotes(filtered);
        if (activeId === id) {
          setActiveId(filtered.length > 0 ? filtered[0].id : null);
        }
        return filtered;
      });
    },
    [activeId, folders, persistFolders, persistLinkFolderMap, persistNotes]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Alt+N for new note
      if (e.altKey && (e.key === 'n' || e.key === 'т' || e.key === 'N')) {
        e.preventDefault();
        handleCreateNote();
      }
      // Ctrl+\ or Cmd+\ for toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
      // Ctrl+L or Cmd+L for quick vault lock
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'д' || e.key === 'L')) {
        e.preventDefault();
        if (vaultMeta && !isVaultLocked) {
          handleLockVault();
        }
      }
      // Esc to clear search if focused
      if (e.key === 'Escape' && document.activeElement?.id === 'sidebar-search-input') {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleCreateNote, handleLockVault, isVaultLocked, vaultMeta]);

  const activeNote = notes.find((n) => n.id === activeId) || null;

  return (
    <div className="relative w-full h-screen flex flex-col bg-white text-neutral-900 overflow-hidden font-sans">
      {/* ================= ONE UNIFIED SEAMLESS TOP HEADER (Floating Island Style) ================= */}
      <header
        id="app-top-header"
        className="fixed top-3.5 sm:top-4 left-0 right-0 z-30 pointer-events-none flex items-center select-none"
      >
        {/* Left Side: Sidebar Controls (Matches Sidebar width exactly) */}
        <div
          className={`flex items-center px-3.5 sm:px-4 transition-all duration-300 ease-out shrink-0 pointer-events-auto ${
            isSidebarCollapsed ? 'w-auto' : 'w-72 sm:w-80'
          }`}
        >
          {isSidebarCollapsed ? (
            /* Signature Pure Logo Toggle Button without background pill when collapsed */
            <button
              id="app-logo-toggle-btn"
              type="button"
              onClick={toggleSidebar}
              title="Розгорнути панель"
              aria-label="Розгорнути панель"
              className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-900 hover:text-neutral-600 hover:bg-neutral-100/80 transition-colors cursor-pointer group shrink-0"
            >
              <LogoIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
            </button>
          ) : (
            /* Floating frosted-glass pill wrapping logo + search + options when expanded */
            <div
              className="inline-flex items-center gap-1 p-1 bg-white/70 backdrop-blur-xl border border-neutral-200/80 shadow-2xs rounded-full transition-all duration-300 ease-out select-none w-full animate-in fade-in duration-200"
            >
              {/* Signature Logo Toggle Button */}
              <button
                id="app-logo-toggle-btn"
                type="button"
                onClick={toggleSidebar}
                title="Згорнути панель"
                aria-label="Згорнути панель"
                className="flex items-center justify-center w-7 h-7 rounded-full text-neutral-900 hover:text-neutral-600 hover:bg-neutral-200/50 transition-colors cursor-pointer group shrink-0"
              >
                <LogoIcon className="w-4.5 h-4.5 transition-transform duration-200 group-hover:scale-105" />
              </button>

              <div className="flex items-center gap-1 flex-1 min-w-0 pr-0.5 animate-in fade-in slide-in-from-left-2 duration-200">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-0 flex items-center">
                  <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" strokeWidth={1.75} />
                  <input
                    id="sidebar-search-input"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Пошук"
                    className="w-full pl-6 pr-5 py-1 text-xs bg-transparent text-neutral-900 placeholder:text-neutral-400 outline-none rounded-full"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Очистити пошук"
                      aria-label="Очистити пошук"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  )}
                </div>

                {/* Add Folder Button */}
                <button
                  id="sidebar-add-folder-btn"
                  type="button"
                  onClick={() => sidebarRef.current?.createFolderDirectly(null)}
                  title={viewMode === 'links' ? 'Створити головну папку для посилань' : 'Створити головну папку'}
                  aria-label="Створити головну папку"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors shrink-0 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" strokeWidth={1.75} />
                </button>

                {/* View mode toggle button */}
                <button
                  id="sidebar-links-toggle-btn"
                  type="button"
                  onClick={handleToggleViewMode}
                  title={viewMode === 'links' ? 'Повернутися до нотаток' : 'Усі збережені посилання'}
                  aria-label={viewMode === 'links' ? 'Повернутися до нотаток' : 'Усі збережені посилання'}
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer ${
                    viewMode === 'links'
                      ? 'text-neutral-950 hover:bg-neutral-200/50'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
                  }`}
                >
                  {viewMode === 'links' ? (
                    <FileText className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Link2 className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>

                {/* New Note Button */}
                <button
                  id="sidebar-new-note-btn"
                  type="button"
                  onClick={handleCreateNote}
                  title="Нова нотатка (Alt+N)"
                  aria-label="Нова нотатка"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center / Editor Space: Perfectly matches EditorPane layout and aligns with document column */}
        <div
          className={`flex-1 min-w-0 relative flex items-center px-6 sm:px-12 md:px-16 transition-all duration-200 pointer-events-auto ${
            !activeNote
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="w-full max-w-3xl mx-auto flex items-center justify-center">
            <EditorToolbar
              isSidebarCollapsed={isSidebarCollapsed}
              isTyping={isTyping}
              onMenuOpenChange={setIsToolbarMenuOpen}
              onExecCommand={(cmd, val) => editorPaneRef.current?.execCommand(cmd, val)}
              onFormatBlock={(tag) => editorPaneRef.current?.formatBlock(tag)}
              onApplyFontFamily={(font) => editorPaneRef.current?.applyFontFamily(font)}
              onApplyFontSize={(size) => editorPaneRef.current?.applyFontSize(size)}
              onApplyLineHeight={(lh) => editorPaneRef.current?.applyLineHeight(lh)}
              onClearFormatting={() => editorPaneRef.current?.clearFormatting()}
              onOpenLinkModal={() => setIsLinkModalOpen(true)}
              onInsertImageFile={(file) => editorPaneRef.current?.insertImageFile(file)}
              onInsertAnchor={() => editorPaneRef.current?.insertAnchor()}
              onInsertTable={(rows, cols) => editorPaneRef.current?.insertTable(rows, cols)}
              onExport={(format) => editorPaneRef.current?.exportNote(format)}
              textColor={textColor}
              onChangeTextColor={(color) => {
                setTextColor(color);
                editorPaneRef.current?.changeTextColor(color);
              }}
              highlightColor={highlightColor}
              onChangeHighlightColor={(color) => {
                setHighlightColor(color);
                editorPaneRef.current?.changeHighlightColor(color);
              }}
            />
          </div>
        </div>

        {/* Far Right: Vault / Security Controls (Absolute positioned so it doesn't offset toolbar centering) */}
        <div className="absolute right-3.5 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-auto z-10">
          <button
            type="button"
            onClick={() => setIsVaultSetupOpen(true)}
            title={vaultMeta ? 'Параметри захисту (захист активний)' : 'Встановити захист нотаток'}
            aria-label={vaultMeta ? 'Параметри захисту (захист активний)' : 'Встановити захист нотаток'}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/70 backdrop-blur-xl border border-neutral-200/80 shadow-2xs hover:bg-white/95 active:bg-neutral-100/90 text-neutral-600 hover:text-neutral-900 transition-colors shrink-0 cursor-pointer"
          >
            {vaultMeta ? (
              <Lock className="w-4 h-4 text-neutral-900" strokeWidth={1.75} />
            ) : (
              <Unlock className="w-4 h-4 text-neutral-500" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </header>

      {/* Main Body (Seamless Continuous Panels) */}
      <div className={`flex-1 flex min-h-0 w-full ${isVaultLocked && vaultMeta ? 'pointer-events-none' : ''}`}>
        {/* Sidebar navigation */}
        <Sidebar
          ref={sidebarRef}
          notes={notes}
          activeId={activeId}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          onCopyNote={handleCopyNote}
          onTogglePin={handleTogglePin}
          onToggleMarked={handleToggleMarked}
          onDeleteNote={handleDeleteNote}
          isCollapsed={isSidebarCollapsed}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          extractedLinks={extractedLinks}
          onNavigateToNote={handleNavigateToNote}
          onDeleteLink={handleDeleteLink}
          folders={folders}
          onAddFolder={handleAddFolder}
          onToggleFolder={handleToggleFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveNoteToFolder={handleMoveNoteToFolder}
          linkFolderMap={linkFolderMap}
          onMoveLinkToFolder={handleMoveLinkToFolder}
          onMoveFolderToFolder={handleMoveFolderToFolder}
          onMarkFolderInteracted={handleMarkFolderInteracted}
        />

        {/* Main editor area */}
        <EditorPane
          ref={editorPaneRef}
          note={activeNote}
          targetAnchorId={targetAnchorId}
          isSidebarCollapsed={isSidebarCollapsed}
          onUpdateNote={handleUpdateActiveNote}
          onCreateNote={handleCreateNote}
          onOpenLinkModal={() => setIsLinkModalOpen(true)}
          textColor={textColor}
          onChangeTextColor={setTextColor}
          highlightColor={highlightColor}
          onChangeHighlightColor={setHighlightColor}
          onTyping={handleEditorTyping}
        />
      </div>

      {/* Floating Quick New Note Button (Visible only when sidebar/layers panel is collapsed) */}
      {isSidebarCollapsed && (!isVaultLocked || !vaultMeta) && (
        <button
          id="floating-quick-new-note-btn"
          type="button"
          onClick={handleCreateNote}
          title="Нова нотатка (Alt+N)"
          aria-label="Нова нотатка"
          className="fixed bottom-6 right-6 z-30 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/75 backdrop-blur-md border border-neutral-200/80 shadow-2xs hover:bg-white/95 active:bg-neutral-100/90 text-neutral-900 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in zoom-in-90"
        >
          <Plus className="w-4 h-4 text-neutral-900" strokeWidth={1.75} />
        </button>
      )}

      {/* Link Modal */}
      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSubmit={(url) => {
          const richLinkHtml = createGraphicLinkHtml(url);
          document.execCommand('insertHTML', false, richLinkHtml);
          handleUpdateActiveNote({});
        }}
      />

      {/* Vault Setup & Security Modal */}
      <VaultSetupModal
        isOpen={isVaultSetupOpen}
        onClose={() => setIsVaultSetupOpen(false)}
        isConfigured={!!vaultMeta}
        currentMeta={vaultMeta}
        onSetupVault={handleSetupVault}
        onChangePassword={handleChangePassword}
        onUpdateAutoLockMinutes={handleUpdateAutoLockMinutes}
        onDisableVault={handleDisableVault}
        onExportBackup={handleExportBackup}
      />

      {/* Vault Auto-Lock & Security Lock Screen Overlay */}
      {isVaultLocked && vaultMeta && (
        <VaultLockScreen
          meta={vaultMeta}
          onUnlock={handleUnlockVault}
          onResetVault={handleResetVault}
        />
      )}
    </div>
  );
}
