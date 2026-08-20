import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  Search,
  Plus,
  Copy,
  Check,
  Pin,
  Bookmark,
  Trash2,
  Link2,
  FileText,
  Anchor,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { Note, Folder } from '../types';
import { formatNoteDate, extractPlainSnippet } from '../utils/storage';
import { ExtractedLink } from '../utils/links';
import { extractNoteSections, findMatchingSectionsInNote, NoteSection } from '../utils/sections';
import { FloatingScrollbar } from './FloatingScrollbar';

export interface SidebarHandle {
  createFolderDirectly: (parentId?: string | null) => void;
}

export interface SidebarProps {
  notes: Note[];
  activeId: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (id: string, anchorId?: string | null) => void;
  onCreateNote: () => void;
  onCopyNote: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onToggleMarked: (id: string, e: React.MouseEvent) => void;
  onDeleteNote: (id: string, e: React.MouseEvent) => void;
  isCollapsed: boolean;
  viewMode: 'notes' | 'links';
  onToggleViewMode: () => void;
  extractedLinks: ExtractedLink[];
  onNavigateToNote: (noteId: string, anchorId?: string | null) => void;
  onDeleteLink: (link: ExtractedLink) => void;
  folders: Folder[];
  onAddFolder: (type: 'notes' | 'links', parentId?: string | null) => string | void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void;
  linkFolderMap: Record<string, string>;
  onMoveLinkToFolder: (linkId: string, folderId: string | null) => void;
  onMoveFolderToFolder: (sourceFolderId: string, targetParentId: string | null) => void;
  onMarkFolderInteracted?: (folderId: string) => void;
}

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(({
  notes,
  activeId,
  searchTerm,
  onSearchChange,
  onSelectNote,
  onCreateNote,
  onCopyNote,
  onTogglePin,
  onToggleMarked,
  onDeleteNote,
  isCollapsed,
  viewMode,
  onToggleViewMode,
  extractedLinks,
  onNavigateToNote,
  onDeleteLink,
  folders,
  onAddFolder,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
  linkFolderMap,
  onMoveLinkToFolder,
  onMoveFolderToFolder,
  onMarkFolderInteracted,
}, ref) => {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);

  const handleCopyLinkUrl = (url: string, linkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).catch(() => {
        fallbackCopyText(url);
      });
    } else {
      fallbackCopyText(url);
    }
    setCopiedLinkId(linkId);
    setTimeout(() => {
      setCopiedLinkId((prev) => (prev === linkId ? null : prev));
    }, 1500);
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const startRename = (folder: Folder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onMarkFolderInteracted?.(folder.id);
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
  };

  const handleFinishRename = () => {
    if (editingFolderId) {
      if (editingFolderName.trim()) {
        onRenameFolder(editingFolderId, editingFolderName.trim());
        onMarkFolderInteracted?.(editingFolderId);
      }
      setEditingFolderId(null);
    }
  };

  const handleCreateFolderDirectly = (parentId?: string | null) => {
    const newId = onAddFolder(viewMode, parentId);
    if (newId) {
      const defaultName = parentId
        ? 'Нова під-папка'
        : viewMode === 'notes'
        ? 'Нова папка'
        : 'Папка посилань';
      setEditingFolderId(newId);
      setEditingFolderName(defaultName);
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  };

  useImperativeHandle(ref, () => ({
    createFolderDirectly: (parentId?: string | null) => handleCreateFolderDirectly(parentId),
  }));

  // Drag & drop handlers
  const handleDragStartNote = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemType: 'note', id: noteId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartLink = (e: React.DragEvent, linkId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemType: 'link', id: linkId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartFolder = (e: React.DragEvent, folderId: string) => {
    e.stopPropagation();
    onMarkFolderInteracted?.(folderId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemType: 'folder', id: folderId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDrop = (e: React.DragEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    onMarkFolderInteracted?.(folder.id);
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.itemType === 'folder') {
        onMoveFolderToFolder(data.id, folder.id);
      } else if (data.itemType === 'note' && folder.type === 'notes') {
        onMoveNoteToFolder(data.id, folder.id);
      } else if (data.itemType === 'link' && folder.type === 'links') {
        onMoveLinkToFolder(data.id, folder.id);
      }
    } catch (err) {
      console.error('Drag error:', err);
    }
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.itemType === 'folder') {
        onMoveFolderToFolder(data.id, null);
      } else if (data.itemType === 'note') {
        onMoveNoteToFolder(data.id, null);
      } else if (data.itemType === 'link') {
        onMoveLinkToFolder(data.id, null);
      }
    } catch (err) {
      console.error('Root drop error:', err);
    }
  };

  // Map of folders by id for quick lookup
  const folderMap = React.useMemo(() => {
    const map: Record<string, Folder> = {};
    folders.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [folders]);

  const getFolderPath = (folderId: string | null | undefined): string => {
    if (!folderId || !folderMap[folderId]) return '';
    const folder = folderMap[folderId];
    if (folder.parentId && folderMap[folder.parentId]) {
      return `${folderMap[folder.parentId].name} / ${folder.name}`;
    }
    return folder.name;
  };

  const isSearching = Boolean(searchTerm.trim());
  const query = searchTerm.toLowerCase().trim();

  // Global search across ALL notes (including all folders, root & section anchors)
  const globalMatchingNotes = React.useMemo(() => {
    if (!isSearching) return notes;
    return notes.filter((n) => {
      const titleMatch = (n.title || '').toLowerCase().includes(query);
      const snippetMatch = extractPlainSnippet(n.content).toLowerCase().includes(query);
      const rawContentMatch = (n.content || '').toLowerCase().includes(query);
      const folderPath = getFolderPath(n.folderId).toLowerCase();
      const folderMatch = folderPath.includes(query);
      const matchingSecs = findMatchingSectionsInNote(n.content, n.title, query);
      return titleMatch || snippetMatch || rawContentMatch || folderMatch || matchingSecs.length > 0;
    });
  }, [notes, isSearching, query, folderMap]);

  // Global search across ALL links (including all folders & root)
  const globalMatchingLinks = React.useMemo(() => {
    if (!isSearching) return extractedLinks;
    return extractedLinks.filter((link) => {
      const titleMatch = (link.displayTitle || '').toLowerCase().includes(query);
      const domainMatch = (link.domain || '').toLowerCase().includes(query);
      const urlMatch = (link.url || '').toLowerCase().includes(query);
      const noteMatch = (link.noteTitle || '').toLowerCase().includes(query);
      const folderId = linkFolderMap[link.id];
      const folderPath = getFolderPath(folderId).toLowerCase();
      const folderMatch = folderPath.includes(query);
      return titleMatch || domainMatch || urlMatch || noteMatch || folderMatch;
    });
  }, [extractedLinks, isSearching, query, linkFolderMap, folderMap]);

  // Active view folders
  const currentFolders = folders.filter((f) => f.type === viewMode);

  // Render Note Item
  const renderNoteItem = (
    note: Note,
    isInsideFolder = false,
    showFolderBadge = false,
    matchingSections?: NoteSection[]
  ) => {
    const isActive = note.id === activeId;
    const snippet = extractPlainSnippet(note.content);
    const hasTable = /<table[\s>]/i.test(note.content || '');
    const parentFolder = note.folderId ? folderMap[note.folderId] : null;
    const sectionsToDisplay = isSearching && matchingSections && matchingSections.length > 0
      ? matchingSections
      : null;

    return (
      <div key={note.id} className="space-y-0.5">
        <div
          id={`note-item-${note.id}`}
          draggable
          onDragStart={(e) => handleDragStartNote(e, note.id)}
          onClick={() => {
            if (note.folderId) onMarkFolderInteracted?.(note.folderId);
            onSelectNote(note.id, sectionsToDisplay ? sectionsToDisplay[0].id : null);
          }}
          className={`group relative flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
            isInsideFolder ? 'ml-3 pl-2' : ''
          } ${
            isActive
              ? 'bg-neutral-100/80 text-neutral-900 font-medium'
              : 'text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          {/* Marker / Active Dot */}
          <div className="pt-1.5 shrink-0">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                note.marked
                  ? 'bg-neutral-900'
                  : isActive
                  ? 'bg-neutral-900'
                  : note.pinned
                  ? 'bg-neutral-400'
                  : 'bg-transparent'
              }`}
            />
          </div>

          {/* Note Meta */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {hasTable && (
                  <span
                    title="Нотатка містить таблицю"
                    className="shrink-0 text-neutral-400 group-hover:text-neutral-500 inline-flex items-center transition-colors"
                  >
                    <TableIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </span>
                )}
                <h3
                  className={`text-xs truncate ${
                    isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-800 font-normal'
                  }`}
                >
                  {note.title.trim() || (hasTable ? 'Таблиця' : 'Без назви')}
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 shrink-0">
                {formatNoteDate(note.updated)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 mt-0.5 min-h-[16px]">
              <p className="text-[11px] text-neutral-400 truncate flex-1">
                {snippet || (hasTable ? 'Інтерактивна таблиця' : <span className="opacity-0">Порожньо</span>)}
              </p>
              {showFolderBadge && parentFolder && (
                <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 shrink-0" title={getFolderPath(note.folderId)}>
                  <FolderIcon className="w-2.5 h-2.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate max-w-[95px]">{getFolderPath(note.folderId)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action buttons on hover / active */}
          <div
            className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => onCopyNote(note.id, e)}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors"
              title="Дублювати"
              aria-label="Дублювати"
            >
              <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={(e) => onTogglePin(note.id, e)}
              className={`w-6 h-6 flex items-center justify-center transition-colors ${
                note.pinned ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-900'
              }`}
              title={note.pinned ? 'Відкріпити' : 'Закріпити вгорі'}
              aria-label={note.pinned ? 'Відкріпити' : 'Закріпити вгорі'}
            >
              <Pin className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={(e) => onToggleMarked(note.id, e)}
              className={`w-6 h-6 flex items-center justify-center transition-colors ${
                note.marked ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-900'
              }`}
              title={note.marked ? 'Зняти маркер' : 'Позначити'}
              aria-label={note.marked ? 'Зняти маркер' : 'Позначити'}
            >
              <Bookmark className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={(e) => onDeleteNote(note.id, e)}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-red-600 transition-colors"
              title="Видалити"
              aria-label="Видалити"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Matching Sections / Anchors sub-items */}
        {sectionsToDisplay && (
          <div className="ml-5 pl-1 space-y-0.5">
            {sectionsToDisplay.map((sec) => (
              <div
                key={sec.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNote(note.id, sec.id);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100/90 transition-colors cursor-pointer group"
                title={`Перейти до розділу «${sec.title}»`}
              >
                <Anchor className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 shrink-0" strokeWidth={1.75} />
                <span className="font-medium text-neutral-700 group-hover:text-neutral-950 truncate max-w-[110px]">
                  {sec.title}
                </span>
                <span className="text-[10px] text-neutral-400 truncate flex-1">
                  {sec.snippet}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Link Item
  const renderLinkItem = (link: ExtractedLink, isInsideFolder = false, showFolderBadge = false) => {
    const parentFolderId = linkFolderMap[link.id];
    const parentFolder = parentFolderId ? folderMap[parentFolderId] : null;

    return (
      <div
        key={link.id}
        id={`link-item-${link.id}`}
        draggable
        onDragStart={(e) => handleDragStartLink(e, link.id)}
        className={`group relative flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-50 transition-colors ${
          isInsideFolder ? 'ml-3 pl-2' : ''
        }`}
      >
        {/* Favicon */}
        <div className="pt-0.5 shrink-0">
          <img
            src={link.faviconUrl}
            alt=""
            className="w-4 h-4 rounded object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Link details: click title opens URL in new tab */}
        <div className="flex-1 min-w-0 pr-1">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (parentFolderId) onMarkFolderInteracted?.(parentFolderId);
            }}
            className="text-xs font-medium text-neutral-900 hover:underline truncate block leading-snug"
            title={link.url}
          >
            {link.displayTitle}
          </a>
          <p className="text-[10px] text-neutral-400 truncate mt-0.5 flex items-center gap-1">
            <span>{link.domain}</span>
            <span>•</span>
            <span className="truncate">{link.noteTitle}</span>
            {showFolderBadge && parentFolder && (
              <>
                <span>•</span>
                <span className="text-neutral-500 truncate max-w-[95px]" title={getFolderPath(parentFolderId)}>
                  {getFolderPath(parentFolderId)}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Actions: Copy Link, Navigate to Note & Delete link */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => handleCopyLinkUrl(link.url, link.id, e)}
            className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-200/50 transition-colors"
            title={copiedLinkId === link.id ? 'Скопійовано!' : 'Скопіювати посилання'}
            aria-label="Скопіювати посилання"
          >
            {copiedLinkId === link.id ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />
            ) : (
              <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (parentFolderId) onMarkFolderInteracted?.(parentFolderId);
              onNavigateToNote(link.noteId);
            }}
            className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-200/50 transition-colors"
            title="Перейти до нотатки"
            aria-label="Перейти до нотатки"
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => onDeleteLink(link)}
            className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
            title="Видалити"
            aria-label="Видалити"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    );
  };

  // Render a Folder block with recursive sub-folders and child items
  const renderFolderTree = (folder: Folder, depth = 0): React.ReactNode => {
    const isDragOver = dragOverFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;

    // Subfolders belonging to this folder
    const childFolders = currentFolders.filter((f) => f.parentId === folder.id);

    // Direct items belonging directly to this folder
    const directLinks = viewMode === 'links'
      ? globalMatchingLinks.filter((l) => linkFolderMap[l.id] === folder.id)
      : [];
    const directNotes = viewMode === 'notes'
      ? globalMatchingNotes.filter((n) => n.folderId === folder.id)
      : [];

    const isSubFolder = depth > 0;

    return (
      <div
        key={folder.id}
        id={`folder-container-${folder.id}`}
        draggable={!isEditing}
        onDragStart={(e) => handleDragStartFolder(e, folder.id)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFolderId(folder.id);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dragOverFolderId === folder.id) setDragOverFolderId(null);
        }}
        onDrop={(e) => handleFolderDrop(e, folder)}
        className={`transition-all ${
          isSubFolder
            ? 'ml-2.5 pl-1 my-0.5 rounded-lg'
            : 'mb-1 rounded-lg'
        } ${
          isDragOver
            ? 'bg-neutral-100/90 ring-2 ring-neutral-800/80 shadow-xs'
            : 'bg-transparent'
        }`}
      >
        {/* Folder Header */}
        <div
          onClick={() => {
            onToggleFolder(folder.id);
            onMarkFolderInteracted?.(folder.id);
          }}
          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-neutral-100/70 cursor-pointer transition-colors ${
            isSubFolder ? 'text-neutral-700' : 'text-neutral-900'
          }`}
        >
          {/* Collapse/Expand Chevron */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFolder(folder.id);
              onMarkFolderInteracted?.(folder.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-800 rounded transition-colors shrink-0"
          >
            {folder.collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>

          {/* Folder Icon */}
          <div className="shrink-0">
            {folder.collapsed ? (
              <FolderIcon className={`w-3.5 h-3.5 ${isSubFolder ? 'text-neutral-400' : 'text-neutral-500'}`} strokeWidth={1.75} />
            ) : (
              <FolderOpen className={`w-3.5 h-3.5 ${isSubFolder ? 'text-neutral-700' : 'text-neutral-950'}`} strokeWidth={1.75} />
            )}
          </div>

          {/* Folder Name / Inline Edit */}
          <div className="flex-1 min-w-0 pr-1">
            {isEditing ? (
              <input
                ref={renameInputRef}
                type="text"
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename();
                  if (e.key === 'Escape') setEditingFolderId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-xs font-medium text-neutral-900 bg-white border border-neutral-300 focus:border-neutral-900 rounded-full px-2.5 py-0.5 outline-none transition-colors"
              />
            ) : (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span
                  onDoubleClick={(e) => startRename(folder, e)}
                  title={`${folder.name} (Подвійний клік щоб змінити назву)`}
                  className={`text-xs truncate block leading-tight hover:text-neutral-950 flex-1 min-w-0 ${
                    isSubFolder ? 'font-normal text-neutral-700' : 'font-medium text-neutral-800'
                  }`}
                >
                  {folder.name}
                </span>
                {folder.autoCreated && !folder.interacted && (
                  <span
                    title="Автоматично створена папка"
                    className="text-[9px] text-neutral-400 font-normal shrink-0 tracking-tight select-none"
                  >
                    авто
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkFolderInteracted?.(folder.id);
                handleCreateFolderDirectly(folder.id);
              }}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-200/50 transition-colors"
              title="Створити під-папку всередині"
              aria-label="Створити під-папку всередині"
            >
              <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={(e) => startRename(folder, e)}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-200/50 transition-colors"
              title="Перейменувати папку"
              aria-label="Перейменувати папку"
            >
              <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder.id);
              }}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
              title="Видалити папку"
              aria-label="Видалити папку"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Folder Content (Sub-folders first, then direct items not in sub-folders) */}
        {!folder.collapsed && (
          <div className="pt-0.5 pb-1 space-y-0.5">
            {/* Sub-folders first */}
            {childFolders.map((subFolder) => renderFolderTree(subFolder, depth + 1))}

            {/* Direct items (items not in any sub-folder) */}
            {viewMode === 'links' && directLinks.map((link) => renderLinkItem(link, true))}
            {viewMode === 'notes' && directNotes.map((note) => renderNoteItem(note, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      id="app-sidebar"
      className={`h-full relative flex flex-col bg-white transition-all duration-200 select-none ${
        isCollapsed ? 'w-0 opacity-0 overflow-hidden pointer-events-none' : 'w-72 sm:w-80 opacity-100'
      }`}
    >
      {/* Floating minimal scrollbar in anchor dot style */}
      <FloatingScrollbar
        containerRef={sidebarScrollRef}
        rightOffsetClass="right-2"
        dotSizeClass="w-1.5 h-1.5"
        topPadding={76}
        bottomPadding={24}
        showTooltip={false}
      />

      {/* Main List Area (Notes or Links) - Scrolls continuously underneath the unified translucent header */}
      <div
        ref={sidebarScrollRef}
        id="sidebar-main-content-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverRoot(true);
        }}
        onDragLeave={() => setIsDragOverRoot(false)}
        onDrop={handleRootDrop}
        className={`flex-1 overflow-y-auto scrollbar-none px-3 pt-[72px] sm:pt-[76px] pb-6 space-y-1 transition-colors [mask-image:linear-gradient(to_bottom,transparent_0px,transparent_4px,black_18px,black_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0px,transparent_4px,black_18px,black_100%)] ${
          isDragOverRoot ? 'bg-neutral-50/70' : ''
        }`}
      >
        {isDragOverRoot && (
          <div className="py-2 px-3 mb-2 border border-dashed border-neutral-400 bg-white/80 rounded-lg text-center text-[11px] text-neutral-600 font-medium shadow-2xs">
            Перетягніть сюди, щоб зробити головною папкою або перемістити в корінь
          </div>
        )}

        {isSearching ? (
          /* ================= UNIFIED GLOBAL SEARCH RESULTS ================= */
          <div className="space-y-0.5 pt-0.5">
            {globalMatchingNotes.length === 0 && globalMatchingLinks.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-neutral-400 leading-relaxed">
                Нічого не знайдено за запитом «{searchTerm}».
              </div>
            ) : (
              <>
                {globalMatchingNotes.map((note) => {
                  const matchingSections = findMatchingSectionsInNote(note.content, note.title, query);
                  return renderNoteItem(note, false, true, matchingSections);
                })}
                {globalMatchingLinks.map((link) => renderLinkItem(link, false, true))}
              </>
            )}
          </div>
        ) : viewMode === 'links' ? (
          /* ================= LINKS VIEW ================= */
          <>
            {/* Hierarchical Root Folders for Links */}
            {(() => {
              const rootFolders = currentFolders.filter((f) => !f.parentId || !folderMap[f.parentId]);
              return rootFolders.map((folder) => renderFolderTree(folder, 0));
            })()}

            {/* Root / Unfiled Links */}
            {(() => {
              const rootLinks = globalMatchingLinks.filter(
                (l) => !linkFolderMap[l.id] || !folderMap[linkFolderMap[l.id]]
              );

              if (extractedLinks.length === 0 && currentFolders.length === 0) {
                return (
                  <div className="px-3 py-8 text-center text-xs text-neutral-400 leading-relaxed">
                    Немає збережених посилань у нотатках.
                  </div>
                );
              }

              return (
                <div className="space-y-0.5">
                  {rootLinks.map((link) => renderLinkItem(link, false))}
                </div>
              );
            })()}
          </>
        ) : (
          /* ================= NOTES VIEW ================= */
          <>
            {/* Hierarchical Root Folders for Notes */}
            {(() => {
              const rootFolders = currentFolders.filter((f) => !f.parentId || !folderMap[f.parentId]);
              return rootFolders.map((folder) => renderFolderTree(folder, 0));
            })()}

            {/* Root / Unfiled Notes */}
            {(() => {
              const rootNotes = globalMatchingNotes.filter(
                (n) => !n.folderId || !folderMap[n.folderId]
              );

              if (notes.length === 0 && currentFolders.length === 0) {
                return (
                  <div className="px-3 py-8 text-center text-xs text-neutral-400 leading-relaxed">
                    Порожньо. Натисніть «+», щоб створити першу нотатку.
                  </div>
                );
              }

              return (
                <div className="space-y-0.5">
                  {rootNotes.map((note) => renderNoteItem(note, false))}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </aside>
  );
});
