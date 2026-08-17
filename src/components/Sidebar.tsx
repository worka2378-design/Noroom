import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Copy,
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

interface SidebarProps {
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
  onAddFolder: (type: 'notes' | 'links') => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void;
  linkFolderMap: Record<string, string>;
  onMoveLinkToFolder: (linkId: string, folderId: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
}) => {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const startRename = (folder: Folder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      }
      setEditingFolderId(null);
    }
  };

  // Drag & drop handlers
  const handleDragStartNote = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemType: 'note', id: noteId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartLink = (e: React.DragEvent, linkId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemType: 'link', id: linkId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDrop = (e: React.DragEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.itemType === 'note' && folder.type === 'notes') {
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
      if (data.itemType === 'note') {
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

  const isSearching = Boolean(searchTerm.trim());
  const query = searchTerm.toLowerCase().trim();

  // Global search across ALL notes (including all folders, root & section anchors)
  const globalMatchingNotes = React.useMemo(() => {
    if (!isSearching) return notes;
    return notes.filter((n) => {
      const titleMatch = (n.title || '').toLowerCase().includes(query);
      const snippetMatch = extractPlainSnippet(n.content).toLowerCase().includes(query);
      const rawContentMatch = (n.content || '').toLowerCase().includes(query);
      const folderName = n.folderId ? (folderMap[n.folderId]?.name || '').toLowerCase() : '';
      const folderMatch = folderName.includes(query);
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
      const folderName = folderId ? (folderMap[folderId]?.name || '').toLowerCase() : '';
      const folderMatch = folderName.includes(query);
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
          onClick={() => onSelectNote(note.id, sectionsToDisplay ? sectionsToDisplay[0].id : null)}
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
                    <TableIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
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
                <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 shrink-0">
                  <FolderIcon className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[80px]">{parentFolder.name}</span>
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
              <Pin className="w-3.5 h-3.5" strokeWidth={note.pinned ? 2.75 : 1.75} />
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
              <Bookmark className="w-3.5 h-3.5" strokeWidth={note.marked ? 2.75 : 1.75} />
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
                <span className="text-neutral-500">{parentFolder.name}</span>
              </>
            )}
          </p>
        </div>

        {/* Actions: Navigate to Note & Delete link */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onNavigateToNote(link.noteId)}
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

  // Render a Folder block
  const renderFolderBlock = (folder: Folder, children: React.ReactNode) => {
    const isDragOver = dragOverFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;

    return (
      <div
        key={folder.id}
        id={`folder-container-${folder.id}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFolderId(folder.id);
        }}
        onDragLeave={() => {
          if (dragOverFolderId === folder.id) setDragOverFolderId(null);
        }}
        onDrop={(e) => handleFolderDrop(e, folder)}
        className={`rounded-lg transition-all mb-1 ${
          isDragOver
            ? 'bg-neutral-100 ring-1 ring-neutral-400 shadow-xs'
            : 'bg-transparent'
        }`}
      >
        {/* Folder Header */}
        <div
          onClick={() => onToggleFolder(folder.id)}
          className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-neutral-100/70 cursor-pointer transition-colors"
        >
          {/* Collapse/Expand Chevron */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFolder(folder.id);
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
              <FolderIcon className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.75} />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-neutral-950" strokeWidth={1.75} />
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
                className="w-full text-xs font-medium text-neutral-900 bg-white border border-neutral-300 rounded px-1.5 py-0.5 outline-none"
              />
            ) : (
              <span
                onDoubleClick={(e) => startRename(folder, e)}
                title="Подвійний клік щоб змінити назву"
                className="text-xs font-medium text-neutral-800 truncate block leading-tight hover:text-neutral-950"
              >
                {folder.name}
              </span>
            )}
          </div>

          {/* Actions */}
          <div
            className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => startRename(folder, e)}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-200/50 transition-colors"
              title="Перейменувати папку"
              aria-label="Перейменувати папку"
            >
              <Edit2 className="w-3 h-3" strokeWidth={1.75} />
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
              <Trash2 className="w-3 h-3" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Folder Content items */}
        {!folder.collapsed && (
          <div className="pt-0.5 pb-1 space-y-0.5">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      id="app-sidebar"
      className={`h-full flex flex-col bg-white transition-all duration-200 select-none ${
        isCollapsed ? 'w-0 opacity-0 overflow-hidden pointer-events-none' : 'w-64 sm:w-72 opacity-100'
      }`}
    >
      {/* Top action header placed in the header row directly to the right of the logo */}
      <div className="h-13 min-h-[50px] flex items-center pl-[48px] pr-3 shrink-0">
        <div className="flex items-center gap-1.5 w-full">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" strokeWidth={1.75} />
            <input
              id="sidebar-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Пошук"
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-neutral-100/70 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-lg outline-none transition-colors placeholder:text-neutral-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-800 transition-colors"
                title="Очистити пошук"
                aria-label="Очистити пошук"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Add Folder Button */}
          <button
            id="sidebar-add-folder-btn"
            type="button"
            onClick={() => onAddFolder(viewMode)}
            title={viewMode === 'links' ? 'Створити папку для посилань' : 'Створити папку'}
            aria-label="Створити папку"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shrink-0"
          >
            <FolderPlus className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {/* View mode toggle button: shows FileText when on links view, Link2 when on notes view */}
          <button
            id="sidebar-links-toggle-btn"
            type="button"
            onClick={onToggleViewMode}
            title={viewMode === 'links' ? 'Повернутися до нотаток' : 'Усі збережені посилання'}
            aria-label={viewMode === 'links' ? 'Повернутися до нотаток' : 'Усі збережені посилання'}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shrink-0"
          >
            {viewMode === 'links' ? (
              <FileText className="w-4 h-4 text-neutral-900" strokeWidth={1.75} />
            ) : (
              <Link2 className="w-4 h-4 text-neutral-600" strokeWidth={1.75} />
            )}
          </button>

          {/* New Note Button */}
          <button
            id="sidebar-new-note-btn"
            type="button"
            onClick={onCreateNote}
            title="Нова нотатка (Alt+N)"
            aria-label="Нова нотатка"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Main List Area (Notes or Links) */}
      <div
        id="sidebar-main-content-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverRoot(true);
        }}
        onDragLeave={() => setIsDragOverRoot(false)}
        onDrop={handleRootDrop}
        className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 transition-colors ${
          isDragOverRoot ? 'bg-neutral-50/50' : ''
        }`}
      >
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
            {/* Folders for Links */}
            {currentFolders.map((folder) => {
              const folderLinks = globalMatchingLinks.filter((l) => linkFolderMap[l.id] === folder.id);
              return renderFolderBlock(
                folder,
                folderLinks.map((link) => renderLinkItem(link, true))
              );
            })}

            {/* Root / Unfiled Links */}
            {(() => {
              const rootLinks = globalMatchingLinks.filter(
                (l) => !linkFolderMap[l.id] || !currentFolders.some((f) => f.id === linkFolderMap[l.id])
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
            {/* Folders for Notes */}
            {currentFolders.map((folder) => {
              const folderNotes = globalMatchingNotes.filter((n) => n.folderId === folder.id);
              return renderFolderBlock(
                folder,
                folderNotes.map((note) => renderNoteItem(note, true))
              );
            })}

            {/* Root / Unfiled Notes */}
            {(() => {
              const rootNotes = globalMatchingNotes.filter(
                (n) => !n.folderId || !currentFolders.some((f) => f.id === n.folderId)
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
};
