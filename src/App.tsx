/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
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
  extractAllLinksFromNotes,
  removeLinkFromContent,
  ExtractedLink,
} from './utils/links';
import {
  SyncSettings,
  loadSyncSettings,
  saveSyncSettings,
  getSavedDirectoryHandle,
  removeSavedDirectoryHandle,
  pickLocalFolder,
  syncVaultToLocalFolder,
} from './utils/fileSync';
import { syncAutoFolders } from './utils/autoFolders';
import { Sidebar, SidebarHandle } from './components/Sidebar';
import { EditorPane, EditorPaneHandle } from './components/EditorPane';
import { NoteHeaderToolbar } from './components/NoteHeaderToolbar';
import { LinkModal } from './components/LinkModal';
import { LogoIcon } from './components/LogoIcon';
import { VaultLockScreen } from './components/VaultLockScreen';
import { VaultSetupModal } from './components/VaultSetupModal';
import { ApiKeyModal } from './components/ApiKeyModal';

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
  const [viewMode, setViewMode] = useState<'notes' | 'links' | 'ai'>('notes');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return safeGetItem(SIDEBAR_STATE_KEY) === 'collapsed';
  });

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [textColor, setTextColor] = useState('#1b1c1e');
  const [highlightColor, setHighlightColor] = useState('#fef08a');

  // PC Folder Sync State
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => loadSyncSettings());
  const [isSyncing, setIsSyncing] = useState(false);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const localFileSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved DirectoryHandle from IndexedDB on startup
  useEffect(() => {
    getSavedDirectoryHandle().then((handle) => {
      if (handle) {
        dirHandleRef.current = handle;
      }
    });
  }, []);

  // Typing state for auto-collapsing secondary toolbar tools and sidebar
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

        // Trigger debounced encrypted auto-save to local PC folder if enabled
        if (dirHandleRef.current && syncSettings.enabled) {
          if (localFileSyncTimeoutRef.current) {
            clearTimeout(localFileSyncTimeoutRef.current);
          }
          localFileSyncTimeoutRef.current = setTimeout(async () => {
            if (dirHandleRef.current && vaultMeta && masterPassword) {
              try {
                setIsSyncing(true);
                await syncVaultToLocalFolder(
                  dirHandleRef.current,
                  currentNotes,
                  currentFolders,
                  currentMap,
                  vaultMeta,
                  masterPassword
                );
                setSyncSettings((prev) => ({ ...prev, lastSyncTimestamp: Date.now() }));
              } catch (e) {
                console.warn('[FileSync] Auto-save to PC folder failed:', e);
              } finally {
                setIsSyncing(false);
              }
            }
          }, 600);
        }
      } else if (!vaultMeta) {
        saveNotesToStorage(currentNotes);
        saveFoldersToStorage(currentFolders);
        saveLinkFolderMapToStorage(currentMap);
      }
    },
    [vaultMeta, masterPassword, syncSettings.enabled]
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

  // Pick local PC folder for automatic encrypted synchronization
  const handlePickFolder = useCallback(async (): Promise<boolean> => {
    try {
      const res = await pickLocalFolder();
      if (!res) return false;
      dirHandleRef.current = res.handle;
      setSyncSettings({
        enabled: true,
        folderName: res.folderName,
        lastSyncTimestamp: Date.now(),
      });
      // If vault is configured and unlocked, perform initial sync right now
      if (vaultMeta && masterPassword) {
        setIsSyncing(true);
        await syncVaultToLocalFolder(
          res.handle,
          notes,
          folders,
          linkFolderMap,
          vaultMeta,
          masterPassword
        );
        setIsSyncing(false);
      }
      return true;
    } catch (err: any) {
      if (!err?.isIframeError) {
        console.warn('Pick folder note:', err);
      }
      throw err;
    }
  }, [folders, linkFolderMap, masterPassword, notes, vaultMeta]);

  // Disconnect local folder
  const handleDisconnectFolder = useCallback(async () => {
    await removeSavedDirectoryHandle();
    dirHandleRef.current = null;
    const next: SyncSettings = {
      enabled: false,
      folderName: null,
      lastSyncTimestamp: null,
    };
    saveSyncSettings(next);
    setSyncSettings(next);
  }, []);

  // Manual Sync Now trigger
  const handleSyncNow = useCallback(async (): Promise<boolean> => {
    if (!dirHandleRef.current) {
      const handle = await getSavedDirectoryHandle();
      if (handle) dirHandleRef.current = handle;
    }
    if (!dirHandleRef.current || !vaultMeta || !masterPassword) {
      return false;
    }
    try {
      setIsSyncing(true);
      await syncVaultToLocalFolder(
        dirHandleRef.current,
        notes,
        folders,
        linkFolderMap,
        vaultMeta,
        masterPassword
      );
      setSyncSettings((prev) => ({ ...prev, lastSyncTimestamp: Date.now() }));
      return true;
    } catch (e) {
      console.error('Sync now failed:', e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [folders, linkFolderMap, masterPassword, notes, vaultMeta]);

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

  const handleToggleViewMode = (mode?: 'notes' | 'links' | 'ai') => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      safeSetItem(SIDEBAR_STATE_KEY, 'expanded');
    }
    if (mode) {
      setViewMode(mode);
    } else {
      setViewMode((prev) => (prev === 'links' ? 'notes' : 'links'));
    }
  };

  const handleTriggerAi = useCallback(() => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      safeSetItem(SIDEBAR_STATE_KEY, 'expanded');
    }
    setViewMode((prev) => (prev === 'ai' ? 'notes' : 'ai'));
  }, [isSidebarCollapsed]);

  const handleInsertIntoActiveNote = useCallback(
    (text: string) => {
      if (editorPaneRef.current) {
        editorPaneRef.current.insertPlainText('\n\n' + text + '\n');
      } else if (activeId) {
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === activeId
              ? {
                  ...n,
                  content: n.content + '<p>' + text.replace(/\n/g, '<br/>') + '</p>',
                  updated: Date.now(),
                }
              : n
          );
          persistNotes(updated);
          return updated;
        });
      }
    },
    [activeId, persistNotes]
  );

  const handleCreateNoteWithContent = useCallback(
    (title: string, content: string) => {
      const newId = uid();
      const htmlContent = '<p>' + content.replace(/\n/g, '<br/>') + '</p>';
      const newNote: Note = {
        id: newId,
        title: title || 'ШІ Нотатка',
        content: htmlContent,
        created: Date.now(),
        updated: Date.now(),
        pinned: false,
        marked: false,
        folderId: null,
      };
      setNotes((prev) => {
        const updated = [newNote, ...prev];
        persistNotes(updated);
        return updated;
      });
      setActiveId(newId);
      setViewMode('notes');
    },
    [persistNotes]
  );

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

    if (window.matchMedia('(max-width: 639px)').matches) {
      setIsSidebarCollapsed(true);
      safeSetItem(SIDEBAR_STATE_KEY, 'collapsed');
    }

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
    if (window.matchMedia('(max-width: 639px)').matches) {
      setIsSidebarCollapsed(true);
      safeSetItem(SIDEBAR_STATE_KEY, 'collapsed');
    }
  }, []);

  const handleNavigateToNote = useCallback((noteId: string, anchorId?: string | null) => {
    setActiveId(noteId);
    setTargetAnchorId(anchorId || null);
    setViewMode('notes');
    if (window.matchMedia('(max-width: 639px)').matches) {
      setIsSidebarCollapsed(true);
      safeSetItem(SIDEBAR_STATE_KEY, 'collapsed');
    }
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
        const updated = prev.map((n) =>
          n.id === id
            ? {
                ...n,
                marked: !n.marked && !n.markerColor,
                markerColor: !n.marked && !n.markerColor ? '#171717' : null,
              }
            : n
        );
        persistNotes(updated);
        return updated;
      });
    },
    [persistNotes]
  );

  const handleChangeNoteMarkerColor = useCallback(
    (id: string, color: string | null) => {
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.id === id
            ? {
                ...n,
                markerColor: color,
                marked: !!color && color !== 'transparent',
                updated: Date.now(),
              }
            : n
        );
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
  const [copiedPreviewText, setCopiedPreviewText] = useState(false);

  const getNoteFolderPath = useCallback(
    (folderId?: string | null): string => {
      if (!folderId) return 'Коренева папка';
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return 'Коренева папка';
      if (folder.parentId) {
        const parent = folders.find((f) => f.id === folder.parentId);
        if (parent) return `${parent.name} / ${folder.name}`;
      }
      return folder.name;
    },
    [folders]
  );

  const handleCopyActiveNoteText = (htmlContent: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlContent;
    const plain = (tmp.textContent || '').trim();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(plain).catch(() => {});
    }
    setCopiedPreviewText(true);
    setTimeout(() => setCopiedPreviewText(false), 1500);
  };

  return (
    <div className="relative w-full h-screen flex flex-col bg-neutral-100/70 text-neutral-900 overflow-hidden font-sans">
      {/* ================= PRIMARY WORKSPACE CONTAINER (MAIN VIEW AND NOTE EDITING SURFACE) ================= */}
      <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center p-2 sm:p-3 md:p-3.5 overflow-hidden">
        <div className="relative w-full max-w-[1600px] h-full max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-1.5rem)] flex flex-col min-h-0">
          {/* Main Card Container */}
          <div
            className={`relative z-10 w-full flex-1 min-h-0 bg-white rounded-3xl sm:rounded-[28px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] border border-neutral-200/90 overflow-hidden flex flex-row ${
              isVaultLocked && vaultMeta ? 'pointer-events-none' : ''
            }`}
          >
          {/* Left Column: Navigation Sidebar */}
          {!isSidebarCollapsed && (
            <div className="absolute inset-0 z-40 w-full max-w-none sm:static sm:z-auto sm:w-72 md:w-80 shrink-0 h-full min-h-0 flex flex-col border-r border-neutral-200/80 bg-white overflow-hidden">
              <Sidebar
                ref={sidebarRef}
                variant="dock"
                notes={notes}
                activeId={activeId}
                activeNote={activeNote}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelectNote={handleSelectNote}
                onCreateNote={handleCreateNote}
                onCopyNote={handleCopyNote}
                onTogglePin={handleTogglePin}
                onToggleMarked={handleToggleMarked}
                onDeleteNote={handleDeleteNote}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebar}
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
                onOpenSettings={() => setIsVaultSetupOpen(true)}
                onTriggerAi={handleTriggerAi}
                onInsertIntoActiveNote={handleInsertIntoActiveNote}
                onCreateNoteWithContent={handleCreateNoteWithContent}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            </div>
          )}

          {/* Right Column: Note Document Preview / Main Editor Container */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full bg-white overflow-hidden">
            {activeNote ? (
              <>
                {/* Header of Note View with Integrated Rich Text Formatting Toolbar & Actions */}
                <NoteHeaderToolbar
                  note={activeNote}
                  folderPath={getNoteFolderPath(activeNote.folderId)}
                  isSidebarCollapsed={isSidebarCollapsed}
                  onToggleSidebar={toggleSidebar}
                  copiedPreviewText={copiedPreviewText}
                  onCopyText={() => handleCopyActiveNoteText(activeNote.content)}
                  onTogglePin={handleTogglePin}
                  onToggleMarked={handleToggleMarked}
                  onDeleteNote={handleDeleteNote}
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
                  onChangeNoteMarkerColor={(color) => handleChangeNoteMarkerColor(activeNote.id, color)}
                  vaultMeta={vaultMeta}
                  onOpenVaultSetup={() => setIsVaultSetupOpen(true)}
                  isTyping={isTyping}
                />

                {/* Main Note Editor Workspace */}
                <EditorPane
                  ref={editorPaneRef}
                  note={activeNote}
                  variant="deck"
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
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400 select-none">
                <LogoIcon className="w-10 h-10 text-neutral-300 mb-3" />
                <p className="text-sm font-medium text-neutral-600">Оберіть або створіть нотатку</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-[260px] mb-4">
                  Натисніть на нотатку в списку зліва або створіть нову для швидкого редагування.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNote}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300/80 rounded-full transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  <span>Нова нотатка</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
          editorPaneRef.current?.insertLink(url);
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
        syncSettings={syncSettings}
        onPickFolder={handlePickFolder}
        onDisconnectFolder={handleDisconnectFolder}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* Google Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
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
