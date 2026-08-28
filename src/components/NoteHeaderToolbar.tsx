import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Anchor,
  Baseline,
  Bold,
  Check,
  ChevronDown,
  Code,
  Code2,
  Download,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoveVertical,
  Palette,
  Pilcrow,
  Plus,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Type,
  Underline,
} from 'lucide-react';
import { Note, TextFormatCommand, BlockFormatCommand } from '../types';
import { VaultMeta } from '../utils/crypto';
import { LogoIcon } from './LogoIcon';
import {
  AnimatedCopyIcon,
  AnimatedPinIcon,
  AnimatedTrashIcon,
  AnimatedLockIcon,
} from './AnimatedIcons';
import {
  TextColorPalette,
  HighlightColorPalette,
  NoteMarkerColorPalette,
} from './ColorPalettePopover';

export const LINE_HEIGHT_OPTIONS = [
  { label: '1.0', value: '1.0', short: '1.0' },
  { label: '1.15', value: '1.15', short: '1.15' },
  { label: '1.25', value: '1.25', short: '1.25' },
  { label: '1.5', value: '1.5', short: '1.5' },
  { label: '1.75', value: '1.75', short: '1.75' },
  { label: '2.0', value: '2.0', short: '2.0' },
];

export const FONT_OPTIONS = [
  { name: 'Times New Roman', value: "'Times New Roman', 'Tinos', Times, Georgia, serif", displayStyle: "'Times New Roman', 'Tinos', serif" },
  { name: 'Inter (Sans)', value: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif", displayStyle: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif', displayStyle: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: "'Open Sans', sans-serif", displayStyle: "'Open Sans', sans-serif" },
  { name: 'EB Garamond', value: "'EB Garamond', Georgia, serif", displayStyle: "'EB Garamond', serif" },
  { name: 'Merriweather', value: 'Merriweather, Georgia, serif', displayStyle: "'Merriweather', serif" },
  { name: 'Lora', value: 'Lora, Georgia, serif', displayStyle: "'Lora', serif" },
  { name: 'PT Serif', value: "'PT Serif', Georgia, serif", displayStyle: "'PT Serif', serif" },
  { name: 'Playfair Display', value: "'Playfair Display', Georgia, serif", displayStyle: "'Playfair Display', serif" },
  { name: 'Montserrat', value: 'Montserrat, sans-serif', displayStyle: 'Montserrat, sans-serif' },
  { name: 'Fira Code', value: "'Fira Code', ui-monospace, monospace", displayStyle: "'Fira Code', monospace" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace", displayStyle: "'JetBrains Mono', monospace" },
];

export const FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px'];

type ToolbarCategory = 'text' | 'structure' | 'insert' | 'note';
type ToolbarMenu =
  | 'headings'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'textColor'
  | 'highlightColor'
  | 'align'
  | 'export'
  | 'noteMarkerColor'
  | null;

export interface NoteHeaderToolbarProps {
  note: Note;
  folderPath?: string;
  isSidebarCollapsed: boolean;
  onToggleSidebar?: () => void;
  copiedPreviewText: boolean;
  onCopyText: () => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onToggleMarked: (id: string, e: React.MouseEvent) => void;
  onDeleteNote: (id: string, e: React.MouseEvent) => void;
  onExecCommand?: (command: TextFormatCommand, value?: string) => void;
  onFormatBlock?: (tag: BlockFormatCommand) => void;
  onApplyFontFamily?: (fontFamily: string) => void;
  onApplyFontSize?: (fontSize: string) => void;
  onApplyLineHeight?: (lineHeight: string) => void;
  onClearFormatting?: () => void;
  onOpenLinkModal?: () => void;
  onInsertImageFile?: (file: File) => void;
  onInsertAnchor?: () => void;
  onInsertTable?: (rows?: number, cols?: number) => void;
  onExport?: (format: 'markdown' | 'html' | 'txt') => void;
  textColor?: string;
  onChangeTextColor?: (color: string) => void;
  highlightColor?: string;
  onChangeHighlightColor?: (color: string) => void;
  onChangeNoteMarkerColor?: (color: string | null) => void;
  vaultMeta?: VaultMeta | null;
  onOpenVaultSetup?: () => void;
  isTyping?: boolean;
}

interface ToolButtonProps {
  label: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  className?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, onClick, active, danger, children, className = '' }) => (
  <button
    type="button"
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`noroom-tool-control ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''} ${className}`}
  >
    {children}
  </button>
);

export const NoteHeaderToolbar: React.FC<NoteHeaderToolbarProps> = ({
  note,
  folderPath,
  isSidebarCollapsed,
  onToggleSidebar,
  copiedPreviewText,
  onCopyText,
  onTogglePin,
  onDeleteNote,
  onExecCommand,
  onFormatBlock,
  onApplyFontFamily,
  onApplyFontSize,
  onApplyLineHeight,
  onClearFormatting,
  onOpenLinkModal,
  onInsertImageFile,
  onInsertAnchor,
  onInsertTable,
  onExport,
  textColor = '#171717',
  onChangeTextColor,
  highlightColor = 'transparent',
  onChangeHighlightColor,
  onChangeNoteMarkerColor,
  vaultMeta,
  onOpenVaultSetup,
}) => {
  const [activeCategory, setActiveCategory] = useState<ToolbarCategory>('text');
  const [activeMenu, setActiveMenu] = useState<ToolbarMenu>(null);
  const [currentFont, setCurrentFont] = useState('Times New Roman');
  const [currentFontSize, setCurrentFontSize] = useState('16px');
  const [currentLineHeight, setCurrentLineHeight] = useState('1.5');
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: true,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    h1: false,
    h2: false,
    h3: false,
    subscript: false,
    superscript: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const updateActiveFormats = useCallback(() => {
    try {
      const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        h1: block === 'h1',
        h2: block === 'h2',
        h3: block === 'h3',
        subscript: document.queryCommandState('subscript'),
        superscript: document.queryCommandState('superscript'),
      });
    } catch {
      // Formatting state is unavailable until the editor has focus.
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats);
    document.addEventListener('input', updateActiveFormats);
    return () => {
      document.removeEventListener('selectionchange', updateActiveFormats);
      document.removeEventListener('input', updateActiveFormats);
    };
  }, [updateActiveFormats]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const toggleMenu = (menu: Exclude<ToolbarMenu, null>) => {
    setActiveMenu((current) => (current === menu ? null : menu));
  };

  const chooseCategory = (category: ToolbarCategory) => {
    setActiveCategory(category);
    setActiveMenu(null);
  };

  const popoverClass = 'noroom-toolbar-popover absolute top-full left-0 z-50 mt-2 rounded-2xl border border-neutral-200 bg-white p-1.5 text-xs text-neutral-800 shadow-xl';
  const menuItemClass = 'flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left transition-colors hover:bg-neutral-100';

  return (
    <div ref={headerRef} id="note-header-toolbar" className="relative z-30 w-full shrink-0 select-none bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onInsertImageFile?.(file);
          event.target.value = '';
        }}
        className="hidden"
      />

      <div className="noroom-document-bar">
        <div className="flex min-w-0 items-center gap-2">
          <ToolButton
            label={isSidebarCollapsed ? 'Відкрити бібліотеку' : 'Згорнути бібліотеку'}
            onClick={onToggleSidebar}
          >
            <LogoIcon className="h-4 w-4" />
          </ToolButton>
          <div className="min-w-0 flex items-center gap-1.5 text-xs">
            {folderPath && <span className="hidden truncate text-neutral-400 sm:inline">{folderPath}</span>}
            {folderPath && <span className="hidden text-neutral-300 sm:inline">/</span>}
            <span className="truncate font-semibold text-neutral-800">{note.title || 'Без назви'}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden text-[11px] text-neutral-400 sm:inline">Збережено</span>
          {onOpenVaultSetup && (
            <ToolButton
              label={vaultMeta ? 'Захищено сейфом' : 'Налаштувати безпеку сейфу'}
              onClick={onOpenVaultSetup}
            >
              <AnimatedLockIcon isLocked={!!vaultMeta} className="h-4 w-4" />
            </ToolButton>
          )}
        </div>
      </div>

      <section className="noroom-editor-ribbon" aria-label="Інструменти редактора">
        <nav className="noroom-toolbar-categories" aria-label="Категорії інструментів">
          <button type="button" aria-pressed={activeCategory === 'text'} onClick={() => chooseCategory('text')}>
            <Type className="h-3.5 w-3.5" />
            <span>Текст</span>
          </button>
          <button type="button" aria-pressed={activeCategory === 'structure'} onClick={() => chooseCategory('structure')}>
            <List className="h-3.5 w-3.5" />
            <span>Структура</span>
          </button>
          <button type="button" aria-pressed={activeCategory === 'insert'} onClick={() => chooseCategory('insert')}>
            <Plus className="h-3.5 w-3.5" />
            <span>Вставка</span>
          </button>
          <button type="button" aria-pressed={activeCategory === 'note'} onClick={() => chooseCategory('note')}>
            <FileText className="h-3.5 w-3.5" />
            <span>Нотатка</span>
          </button>
        </nav>

        <div className="noroom-toolbar-tools" aria-live="polite">
          {activeCategory === 'text' && (
            <>
              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <ToolButton label="Стиль тексту" active={activeMenu === 'headings'} onClick={() => toggleMenu('headings')} className="is-wide">
                      {activeFormats.h1 ? <span>H1</span> : activeFormats.h2 ? <span>H2</span> : activeFormats.h3 ? <span>H3</span> : <Type className="h-4 w-4" />}
                      <ChevronDown className="h-3 w-3 text-neutral-400" />
                    </ToolButton>
                    {activeMenu === 'headings' && (
                      <div className={`${popoverClass} w-48`}>
                        {[
                          ['p', 'Звичайний текст', Pilcrow],
                          ['h1', 'Заголовок 1', Heading1],
                          ['h2', 'Заголовок 2', Heading2],
                          ['h3', 'Заголовок 3', Heading3],
                        ].map(([tag, label, Icon]) => (
                          <button key={String(tag)} type="button" className={menuItemClass} onMouseDown={(event) => event.preventDefault()} onClick={() => { onFormatBlock?.(tag as BlockFormatCommand); setActiveMenu(null); }}>
                            {React.createElement(Icon as React.ElementType, { className: 'h-4 w-4 text-neutral-500' })}
                            <span>{String(label)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <ToolButton label="Шрифт" active={activeMenu === 'font'} onClick={() => toggleMenu('font')} className="is-wide">
                      <span className="max-w-28 truncate">{currentFont}</span>
                      <ChevronDown className="h-3 w-3 text-neutral-400" />
                    </ToolButton>
                    {activeMenu === 'font' && (
                      <div className={`${popoverClass} max-h-72 w-56 overflow-y-auto`}>
                        {FONT_OPTIONS.map((font) => (
                          <button key={font.name} type="button" className={`${menuItemClass} justify-between`} style={{ fontFamily: font.value }} onMouseDown={(event) => event.preventDefault()} onClick={() => { onApplyFontFamily?.(font.value); setCurrentFont(font.name); setActiveMenu(null); }}>
                            <span className="truncate">{font.name}</span>
                            {currentFont === font.name && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <ToolButton label="Розмір шрифту" active={activeMenu === 'fontSize'} onClick={() => toggleMenu('fontSize')} className="is-wide is-compact">
                      <span>{currentFontSize}</span>
                      <ChevronDown className="h-3 w-3 text-neutral-400" />
                    </ToolButton>
                    {activeMenu === 'fontSize' && (
                      <div className={`${popoverClass} max-h-64 w-28 overflow-y-auto`}>
                        {FONT_SIZES.map((size) => (
                          <button key={size} type="button" className={`${menuItemClass} justify-between`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onApplyFontSize?.(size); setCurrentFontSize(size); setActiveMenu(null); }}>
                            <span>{size}</span>
                            {currentFontSize === size && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <ToolButton label="Міжрядковий інтервал" active={activeMenu === 'lineHeight'} onClick={() => toggleMenu('lineHeight')} className="is-wide is-compact">
                      <MoveVertical className="h-3.5 w-3.5" />
                      <span>{currentLineHeight}</span>
                      <ChevronDown className="h-3 w-3 text-neutral-400" />
                    </ToolButton>
                    {activeMenu === 'lineHeight' && (
                      <div className={`${popoverClass} w-28`}>
                        {LINE_HEIGHT_OPTIONS.map((height) => (
                          <button key={height.value} type="button" className={`${menuItemClass} justify-between`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onApplyLineHeight?.(height.value); setCurrentLineHeight(height.value); setActiveMenu(null); }}>
                            <span>{height.label}</span>
                            {currentLineHeight === height.value && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <ToolButton label="Жирний (Ctrl+B)" active={activeFormats.bold} onClick={() => onExecCommand?.('bold')}><Bold className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Курсив (Ctrl+I)" active={activeFormats.italic} onClick={() => onExecCommand?.('italic')}><Italic className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Підкреслений (Ctrl+U)" active={activeFormats.underline} onClick={() => onExecCommand?.('underline')}><Underline className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Закреслений" active={activeFormats.strikethrough} onClick={() => onExecCommand?.('strikeThrough')}><Strikethrough className="h-4 w-4" /></ToolButton>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <ToolButton label="Колір тексту" active={activeMenu === 'textColor'} onClick={() => toggleMenu('textColor')}>
                      <span className="flex flex-col items-center"><Baseline className="h-4 w-4" /><span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: textColor }} /></span>
                    </ToolButton>
                    {activeMenu === 'textColor' && <TextColorPalette currentColor={textColor} onSelectColor={(color) => { onChangeTextColor?.(color); setActiveMenu(null); }} onClose={() => setActiveMenu(null)} />}
                  </div>
                  <div className="relative">
                    <ToolButton label="Маркер" active={activeMenu === 'highlightColor'} onClick={() => toggleMenu('highlightColor')}>
                      <span className="flex flex-col items-center"><Highlighter className="h-4 w-4" />{highlightColor !== 'transparent' && <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: highlightColor }} />}</span>
                    </ToolButton>
                    {activeMenu === 'highlightColor' && <HighlightColorPalette currentColor={highlightColor} onSelectColor={(color) => { onChangeHighlightColor?.(color); setActiveMenu(null); }} onClose={() => setActiveMenu(null)} />}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeCategory === 'structure' && (
            <>
              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <ToolButton label="Вирівнювання" active={activeMenu === 'align'} onClick={() => toggleMenu('align')} className="is-wide is-compact">
                      {activeFormats.justifyCenter ? <AlignCenter className="h-4 w-4" /> : activeFormats.justifyRight ? <AlignRight className="h-4 w-4" /> : activeFormats.justifyFull ? <AlignJustify className="h-4 w-4" /> : <AlignLeft className="h-4 w-4" />}
                      <span>Вирівнювання</span><ChevronDown className="h-3 w-3 text-neutral-400" />
                    </ToolButton>
                    {activeMenu === 'align' && (
                      <div className={`${popoverClass} w-40`}>
                        {[
                          ['justifyLeft', 'По лівому', AlignLeft],
                          ['justifyCenter', 'По центру', AlignCenter],
                          ['justifyRight', 'По правому', AlignRight],
                          ['justifyFull', 'По ширині', AlignJustify],
                        ].map(([command, label, Icon]) => (
                          <button key={String(command)} type="button" className={menuItemClass} onMouseDown={(event) => event.preventDefault()} onClick={() => { onExecCommand?.(command as TextFormatCommand); setActiveMenu(null); }}>
                            {React.createElement(Icon as React.ElementType, { className: 'h-4 w-4 text-neutral-500' })}<span>{String(label)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <ToolButton label="Маркований список" active={activeFormats.insertUnorderedList} onClick={() => onExecCommand?.('insertUnorderedList')}><List className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Нумерований список" active={activeFormats.insertOrderedList} onClick={() => onExecCommand?.('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Цитата" onClick={() => onFormatBlock?.('blockquote')}><Quote className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Блок коду" onClick={() => onFormatBlock?.('pre')}><Code className="h-4 w-4" /></ToolButton>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <ToolButton label="Підрядковий індекс" active={activeFormats.subscript} onClick={() => onExecCommand?.('subscript')}><Subscript className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Надрядковий індекс" active={activeFormats.superscript} onClick={() => onExecCommand?.('superscript')}><Superscript className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Очистити форматування" onClick={onClearFormatting}><RemoveFormatting className="h-4 w-4" /></ToolButton>
                </div>
              </div>
            </>
          )}

          {activeCategory === 'insert' && (
            <>
              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <ToolButton label="Вставити посилання" onClick={onOpenLinkModal}><Link2 className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Вставити фото" onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Вставити таблицю 3×3" onClick={() => onInsertTable?.(3, 3)}><TableIcon className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Вставити якір навігації" onClick={onInsertAnchor}><Anchor className="h-4 w-4" /></ToolButton>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <ToolButton label="Заголовок 1" onClick={() => onFormatBlock?.('h1')}><Heading1 className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Заголовок 2" onClick={() => onFormatBlock?.('h2')}><Heading2 className="h-4 w-4" /></ToolButton>
                  <ToolButton label="Звичайний абзац" onClick={() => onFormatBlock?.('p')}><Pilcrow className="h-4 w-4" /></ToolButton>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="relative">
                  <ToolButton label="Експорт" active={activeMenu === 'export'} onClick={() => toggleMenu('export')} className="is-wide is-compact"><Download className="h-4 w-4" /><span>Експорт</span><ChevronDown className="h-3 w-3 text-neutral-400" /></ToolButton>
                  {activeMenu === 'export' && (
                    <div className={`${popoverClass} w-44`}>
                      <button type="button" className={menuItemClass} onMouseDown={(event) => event.preventDefault()} onClick={() => { onExport?.('markdown'); setActiveMenu(null); }}><FileText className="h-4 w-4" /><span>Markdown (.md)</span></button>
                      <button type="button" className={menuItemClass} onMouseDown={(event) => event.preventDefault()} onClick={() => { onExport?.('html'); setActiveMenu(null); }}><Code2 className="h-4 w-4" /><span>HTML (.html)</span></button>
                      <button type="button" className={menuItemClass} onMouseDown={(event) => event.preventDefault()} onClick={() => { onExport?.('txt'); setActiveMenu(null); }}><FileText className="h-4 w-4" /><span>Text (.txt)</span></button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeCategory === 'note' && (
            <>
              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  <ToolButton label={copiedPreviewText ? 'Скопійовано' : 'Скопіювати текст'} active={copiedPreviewText} onClick={onCopyText}><AnimatedCopyIcon isCopied={copiedPreviewText} className="h-4 w-4" /></ToolButton>
                  <ToolButton label={note.pinned ? 'Відкріпити' : 'Закріпити'} active={!!note.pinned} onClick={(event) => onTogglePin(note.id, event)}><AnimatedPinIcon isPinned={!!note.pinned} className="h-4 w-4" /></ToolButton>
                  <div className="relative">
                    <ToolButton label="Маркер нотатки" active={activeMenu === 'noteMarkerColor'} onClick={() => toggleMenu('noteMarkerColor')}><Palette className="h-4 w-4" /></ToolButton>
                    {activeMenu === 'noteMarkerColor' && <NoteMarkerColorPalette currentColor={note.markerColor || (note.marked ? '#171717' : null)} onSelectColor={(color) => { onChangeNoteMarkerColor?.(color); setActiveMenu(null); }} onClose={() => setActiveMenu(null)} />}
                  </div>
                  <ToolButton label="Видалити нотатку" danger onClick={(event) => onDeleteNote(note.id, event)}><AnimatedTrashIcon className="h-4 w-4" /></ToolButton>
                </div>
              </div>

              <div className="noroom-toolbar-group">
                <div className="flex items-center gap-1">
                  {onOpenVaultSetup && <ToolButton label={vaultMeta ? 'Налаштування сейфу' : 'Захистити сейф'} onClick={onOpenVaultSetup}><AnimatedLockIcon isLocked={!!vaultMeta} className="h-4 w-4" /></ToolButton>}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
