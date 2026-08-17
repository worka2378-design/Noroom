/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
} from './utils/storage';
import {
  createGraphicLinkHtml,
  extractAllLinksFromNotes,
  removeLinkFromContent,
  ExtractedLink,
} from './utils/links';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { LinkModal } from './components/LinkModal';
import { LogoIcon } from './components/LogoIcon';

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => loadSavedNotes());
  const [folders, setFolders] = useState<Folder[]>(() => loadSavedFolders());
  const [linkFolderMap, setLinkFolderMap] = useState<Record<string, string>>(() =>
    loadSavedLinkFolderMap()
  );
  const [activeId, setActiveId] = useState<string | null>(() => {
    const initial = loadSavedNotes();
    return initial.length > 0 ? initial[0].id : null;
  });
  const [targetAnchorId, setTargetAnchorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'notes' | 'links'>('notes');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STATE_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [textColor, setTextColor] = useState('#1b1c1e');
  const [highlightColor, setHighlightColor] = useState('#fef08a');

  // Debounced storage save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const persistNotes = useCallback((updatedNotes: Note[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNotesToStorage(updatedNotes);
    }, 200);
  }, []);

  const persistFolders = useCallback((updatedFolders: Folder[]) => {
    saveFoldersToStorage(updatedFolders);
  }, []);

  const persistLinkFolderMap = useCallback((updatedMap: Record<string, string>) => {
    saveLinkFolderMapToStorage(updatedMap);
  }, []);

  // Compute all extracted links across all notes
  const extractedLinks = useMemo(() => {
    return extractAllLinksFromNotes(notes);
  }, [notes]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, next ? 'collapsed' : 'expanded');
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleToggleViewMode = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, 'expanded');
      } catch (e) {
        console.error(e);
      }
    }
    setViewMode((prev) => (prev === 'links' ? 'notes' : 'links'));
  };

  // Folder Operations
  const handleAddFolder = useCallback(
    (type: 'notes' | 'links') => {
      const newFolder: Folder = {
        id: 'f-' + uid(),
        name: type === 'notes' ? 'Нова папка' : 'Папка посилань',
        type,
        collapsed: false,
      };

      setFolders((prev) => {
        const next = [...prev, newFolder];
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
          f.id === folderId ? { ...f, collapsed: !f.collapsed } : f
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
          f.id === folderId ? { ...f, name: newName } : f
        );
        persistFolders(next);
        return next;
      });
    },
    [persistFolders]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      if (!window.confirm('Видалити цю папку? (Вміст залишиться у списку)')) return;

      setFolders((prev) => {
        const next = prev.filter((f) => f.id !== folderId);
        persistFolders(next);
        return next;
      });

      // Clear folderId from notes in this folder
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.folderId === folderId ? { ...n, folderId: null } : n
        );
        persistNotes(updated);
        return updated;
      });

      // Clear links from linkFolderMap
      setLinkFolderMap((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((k) => {
          if (updated[k] === folderId) {
            delete updated[k];
          }
        });
        persistLinkFolderMap(updated);
        return updated;
      });
    },
    [persistFolders, persistNotes, persistLinkFolderMap]
  );

  const handleMoveNoteToFolder = useCallback(
    (noteId: string, folderId: string | null) => {
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.id === noteId ? { ...n, folderId, updated: Date.now() } : n
        );
        persistNotes(updated);
        return updated;
      });
    },
    [persistNotes]
  );

  const handleMoveLinkToFolder = useCallback(
    (linkId: string, folderId: string | null) => {
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
    [persistLinkFolderMap]
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

      setNotes((prev) => {
        const filtered = prev.filter((n) => n.id !== id);
        persistNotes(filtered);
        if (activeId === id) {
          setActiveId(filtered.length > 0 ? filtered[0].id : null);
        }
        return filtered;
      });
    },
    [activeId, persistNotes]
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
      // Esc to clear search if focused
      if (e.key === 'Escape' && document.activeElement?.id === 'sidebar-search-input') {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleCreateNote]);

  const activeNote = notes.find((n) => n.id === activeId) || null;

  return (
    <div className="relative w-full h-screen flex bg-white text-neutral-900 overflow-hidden font-sans">
      {/* Signature Logo Toggle Button in Top Header */}
      <button
        id="app-logo-toggle-btn"
        type="button"
        onClick={toggleSidebar}
        title={isSidebarCollapsed ? 'Розгорнути панель' : 'Згорнути панель'}
        aria-label="Згорнути / розгорнути панель"
        className="fixed left-3.5 top-2.5 z-40 flex items-center justify-center w-8 h-8 rounded-lg text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer group"
      >
        <LogoIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
      </button>

      {/* Sidebar navigation */}
      <Sidebar
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
      />

      {/* Main editor area */}
      <EditorPane
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
      />

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
    </div>
  );
}
