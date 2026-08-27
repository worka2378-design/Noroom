import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  RemoveFormatting,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Image as ImageIcon,
  Anchor,
  Baseline,
  Highlighter,
  Download,
  FileText,
  Code2,
  Type,
  Table as TableIcon,
  ChevronDown,
  Check,
  Subscript,
  Superscript,
  MoveVertical,
  Palette,
} from 'lucide-react';
import { Note, TextFormatCommand, BlockFormatCommand } from '../types';
import { VaultMeta } from '../utils/crypto';
import { LogoIcon } from './LogoIcon';
import {
  AnimatedCopyIcon,
  AnimatedPinIcon,
  AnimatedBookmarkIcon,
  AnimatedTrashIcon,
  AnimatedLockIcon,
} from './AnimatedIcons';
import { TextColorPalette, HighlightColorPalette, NoteMarkerColorPalette } from './ColorPalettePopover';

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
  { name: 'Inter (Sans)', value: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif", displayStyle: "Inter, sans-serif" },
  { name: 'Roboto', value: "Roboto, sans-serif", displayStyle: "Roboto, sans-serif" },
  { name: 'Open Sans', value: "'Open Sans', sans-serif", displayStyle: "'Open Sans', sans-serif" },
  { name: 'EB Garamond', value: "'EB Garamond', Georgia, serif", displayStyle: "'EB Garamond', serif" },
  { name: 'Merriweather', value: "Merriweather, Georgia, serif", displayStyle: "Merriweather, serif" },
  { name: 'Lora', value: "Lora, Georgia, serif", displayStyle: "Lora, serif" },
  { name: 'PT Serif', value: "'PT Serif', Georgia, serif", displayStyle: "'PT Serif', serif" },
  { name: 'Playfair Display', value: "'Playfair Display', Georgia, serif", displayStyle: "'Playfair Display', serif" },
  { name: 'Montserrat', value: "Montserrat, sans-serif", displayStyle: "Montserrat, sans-serif" },
  { name: 'Fira Code', value: "'Fira Code', ui-monospace, monospace", displayStyle: "'Fira Code', monospace" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace", displayStyle: "'JetBrains Mono', monospace" },
];

export const FONT_SIZES = [
  '12px',
  '13px',
  '14px',
  '15px',
  '16px',
  '18px',
  '20px',
  '24px',
  '28px',
  '32px',
];

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

export const NoteHeaderToolbar: React.FC<NoteHeaderToolbarProps> = ({
  note,
  isSidebarCollapsed,
  onToggleSidebar,
  copiedPreviewText,
  onCopyText,
  onTogglePin,
  onToggleMarked,
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
  const [activeMenu, setActiveMenu] = useState<
    'headings' | 'font' | 'fontSize' | 'lineHeight' | 'textColor' | 'highlightColor' | 'align' | 'export' | 'noteMarkerColor' | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (
    menu: 'headings' | 'font' | 'fontSize' | 'lineHeight' | 'textColor' | 'highlightColor' | 'align' | 'export' | 'noteMarkerColor'
  ) => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const closeAllMenus = () => {
    setActiveMenu(null);
  };

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    h1: false,
    h2: false,
    h3: false,
    subscript: false,
    superscript: false,
  });

  const [currentFont, setCurrentFont] = useState<string>('Times New Roman');
  const [currentFontSize, setCurrentFontSize] = useState<string>('16px');
  const [currentLineHeight, setCurrentLineHeight] = useState<string>('1.5');

  // Query selection format state
  const updateActiveFormats = useCallback(() => {
    try {
      if (!document.queryCommandState) return;
      const formatBlockVal = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      const sel = window.getSelection();
      let isH1 = formatBlockVal === 'h1' || formatBlockVal === '<h1>';
      let isH2 = formatBlockVal === 'h2' || formatBlockVal === '<h2>';
      let isH3 = formatBlockVal === 'h3' || formatBlockVal === '<h3>';
      let isBold = document.queryCommandState('bold');
      let isItalic = document.queryCommandState('italic');
      let isUnderline = document.queryCommandState('underline');
      let isStrikethrough = document.queryCommandState('strikeThrough');
      let isUnorderedList = document.queryCommandState('insertUnorderedList');
      let isOrderedList = document.queryCommandState('insertOrderedList');
      let isSubscript = document.queryCommandState('subscript');
      let isSuperscript = document.queryCommandState('superscript');
      let isJustifyLeft = document.queryCommandState('justifyLeft');
      let isJustifyCenter = document.queryCommandState('justifyCenter');
      let isJustifyRight = document.queryCommandState('justifyRight');
      let isJustifyFull = document.queryCommandState('justifyFull');

      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        if (node && (node as HTMLElement).closest) {
          const el = node as HTMLElement;
          const heading = el.closest('h1, h2, h3, p, blockquote, pre');
          if (heading) {
            const tag = heading.tagName.toLowerCase();
            if (tag === 'h1') { isH1 = true; isH2 = false; isH3 = false; }
            else if (tag === 'h2') { isH1 = false; isH2 = true; isH3 = false; }
            else if (tag === 'h3') { isH1 = false; isH2 = false; isH3 = true; }
            else if (tag === 'p') { isH1 = false; isH2 = false; isH3 = false; }
          }

          if (el.closest('b, strong')) isBold = true;
          if (el.closest('i, em')) isItalic = true;
          if (el.closest('u')) isUnderline = true;
          if (el.closest('s, strike, del')) isStrikethrough = true;
          if (el.closest('ul')) isUnorderedList = true;
          if (el.closest('ol')) isOrderedList = true;
          if (el.closest('sub')) isSubscript = true;
          if (el.closest('sup')) isSuperscript = true;

          const computed = window.getComputedStyle(el);
          if (computed.fontWeight === 'bold' || parseInt(computed.fontWeight, 10) >= 600) {
            isBold = true;
          }
          if (computed.fontStyle === 'italic') {
            isItalic = true;
          }
          if (computed.textDecorationLine?.includes('underline')) {
            isUnderline = true;
          }
          if (computed.textDecorationLine?.includes('line-through')) {
            isStrikethrough = true;
          }

          if (computed.textAlign === 'center') {
            isJustifyCenter = true; isJustifyLeft = false; isJustifyRight = false; isJustifyFull = false;
          } else if (computed.textAlign === 'right') {
            isJustifyRight = true; isJustifyLeft = false; isJustifyCenter = false; isJustifyFull = false;
          } else if (computed.textAlign === 'justify') {
            isJustifyFull = true; isJustifyLeft = false; isJustifyCenter = false; isJustifyRight = false;
          } else if (computed.textAlign === 'left' || computed.textAlign === 'start') {
            isJustifyLeft = true; isJustifyCenter = false; isJustifyRight = false; isJustifyFull = false;
          }

          const block = el.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div') as HTMLElement | null;

          // 1. Font Family
          const rawFont = (el.style.fontFamily || (block ? block.style.fontFamily : '') || computed.fontFamily || '').toLowerCase().replace(/['"]/g, '');
          if (rawFont) {
            const matched = FONT_OPTIONS.find((f) => {
              const nameLow = f.name.toLowerCase().replace(/['"]/g, '');
              const firstPart = f.value.toLowerCase().split(',')[0].replace(/['"]/g, '').trim();
              return rawFont.includes(nameLow) || rawFont.includes(firstPart);
            });
            if (matched) setCurrentFont(matched.name);
          }

          // 2. Font Size
          const inlineSize = el.style.fontSize || (block ? block.style.fontSize : '');
          if (inlineSize && FONT_SIZES.includes(inlineSize)) {
            setCurrentFontSize(inlineSize);
          } else if (computed.fontSize) {
            const pxNum = Math.round(parseFloat(computed.fontSize));
            const pxStr = `${pxNum}px`;
            const matched = FONT_SIZES.find((s) => s === pxStr || Math.abs(parseInt(s, 10) - pxNum) <= 1);
            if (matched) {
              setCurrentFontSize(matched);
            } else if (pxNum > 0) {
              setCurrentFontSize(pxStr);
            }
          }

          // 3. Line Height
          const inlineLh = el.style.lineHeight || (block ? block.style.lineHeight : '');
          if (inlineLh) {
            const matchedLh = LINE_HEIGHT_OPTIONS.find((l) => l.value === inlineLh);
            if (matchedLh) setCurrentLineHeight(matchedLh.value);
            else setCurrentLineHeight(inlineLh);
          } else if (computed.lineHeight && computed.fontSize) {
            const lhPx = parseFloat(computed.lineHeight);
            const fsPx = parseFloat(computed.fontSize);
            if (!isNaN(lhPx) && !isNaN(fsPx) && fsPx > 0) {
              const ratio = lhPx / fsPx;
              const matched = LINE_HEIGHT_OPTIONS.find((l) => Math.abs(parseFloat(l.value) - ratio) < 0.13);
              if (matched) {
                setCurrentLineHeight(matched.value);
              }
            }
          }
        }
      }

      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strikethrough: isStrikethrough,
        insertUnorderedList: isUnorderedList,
        insertOrderedList: isOrderedList,
        justifyLeft: isJustifyLeft,
        justifyCenter: isJustifyCenter,
        justifyRight: isJustifyRight,
        justifyFull: isJustifyFull,
        h1: isH1,
        h2: isH2,
        h3: isH3,
        subscript: isSubscript,
        superscript: isSuperscript,
      });
    } catch {
      // Ignored in non-browser context
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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onInsertImageFile) {
      onInsertImageFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isVaultProtected = !!vaultMeta;

  return (
    <div
      ref={headerRef}
      id="note-header-toolbar"
      className="relative z-30 w-full h-11 px-1.5 sm:px-3 bg-white border-b border-neutral-200/70 select-none flex items-center justify-between gap-1 sm:gap-1.5 shrink-0 transition-colors"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* ================= PRIMARY HORIZONTAL SINGLE-ROW TOOLBAR ================= */}
      <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1 py-1">
        {/* Sidebar Toggle when collapsed */}
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Розгорнути бічну панель (Ctrl+B)"
            aria-label="Розгорнути бічну панель"
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer mr-0.5 shrink-0"
          >
            <LogoIcon className="w-4 h-4" />
          </button>
        )}

        {/* Heading Style Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('headings')}
            className={`h-7 px-2 flex items-center gap-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeMenu === 'headings' || activeFormats.h1 || activeFormats.h2 || activeFormats.h3
                ? 'bg-neutral-100 text-neutral-950 font-semibold'
                : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Стиль тексту та заголовки"
          >
            {activeFormats.h1 ? (
              <span className="font-bold text-xs">H1</span>
            ) : activeFormats.h2 ? (
              <span className="font-bold text-xs">H2</span>
            ) : activeFormats.h3 ? (
              <span className="font-bold text-xs">H3</span>
            ) : (
              <Type className="w-3.5 h-3.5" />
            )}
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {activeMenu === 'headings' && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 w-44 flex flex-col gap-0.5 text-xs text-neutral-800 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onFormatBlock?.('p');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <Pilcrow className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-normal">Звичайний текст</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onFormatBlock?.('h1');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left font-bold transition-colors cursor-pointer"
              >
                <Heading1 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Заголовок 1</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onFormatBlock?.('h2');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left font-semibold transition-colors cursor-pointer"
              >
                <Heading2 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Заголовок 2</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onFormatBlock?.('h3');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left font-medium transition-colors cursor-pointer"
              >
                <Heading3 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Заголовок 3</span>
              </button>
            </div>
          )}
        </div>

        {/* Font Family Picker */}
        <div className="relative shrink-0 hidden sm:block">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('font')}
            className={`h-7 px-2 flex items-center gap-1 rounded-full text-neutral-700 hover:text-neutral-950 font-medium text-xs transition-colors cursor-pointer ${
              activeMenu === 'font' ? 'bg-neutral-100 font-semibold text-neutral-950' : 'hover:bg-neutral-100'
            }`}
            title="Шрифт тексту"
          >
            <span className="truncate max-w-[90px] sm:max-w-[110px]">{currentFont}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {activeMenu === 'font' && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 w-52 max-h-72 overflow-y-auto flex flex-col gap-0.5 text-xs text-neutral-800 animate-in fade-in zoom-in-95 duration-150">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onApplyFontFamily?.(f.value);
                    setCurrentFont(f.name);
                    setActiveMenu(null);
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer ${
                    currentFont === f.name ? 'bg-neutral-100 font-semibold text-neutral-950' : ''
                  }`}
                  style={{ fontFamily: f.value }}
                >
                  <span className="truncate">{f.name}</span>
                  {currentFont === f.name && <Check className="w-3 h-3 text-neutral-900 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Picker */}
        <div className="relative shrink-0 hidden sm:block">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('fontSize')}
            className={`h-7 px-1.5 flex items-center gap-0.5 rounded-full text-neutral-700 hover:text-neutral-950 font-medium text-xs transition-colors cursor-pointer ${
              activeMenu === 'fontSize' ? 'bg-neutral-100 font-semibold text-neutral-950' : 'hover:bg-neutral-100'
            }`}
            title="Розмір шрифту"
          >
            <span>{currentFontSize}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {activeMenu === 'fontSize' && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 w-24 max-h-64 overflow-y-auto flex flex-col gap-0.5 text-xs text-neutral-800 animate-in fade-in zoom-in-95 duration-150">
              {FONT_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onApplyFontSize?.(s);
                    setCurrentFontSize(s);
                    setActiveMenu(null);
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer ${
                    currentFontSize === s ? 'bg-neutral-100 font-semibold text-neutral-950' : ''
                  }`}
                >
                  <span>{s}</span>
                  {currentFontSize === s && <Check className="w-3 h-3 text-neutral-900 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line Height Selector */}
        <div className="relative shrink-0 hidden sm:block">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('lineHeight')}
            className={`h-7 px-1.5 flex items-center gap-0.5 rounded-full text-neutral-700 hover:text-neutral-950 font-medium text-xs transition-colors cursor-pointer ${
              activeMenu === 'lineHeight' ? 'bg-neutral-100 font-semibold text-neutral-950' : 'hover:bg-neutral-100'
            }`}
            title="Міжрядковий інтервал"
          >
            <MoveVertical className="w-3 h-3 text-neutral-500" />
            <span className="hidden sm:inline">{currentLineHeight}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {activeMenu === 'lineHeight' && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 w-28 flex flex-col gap-0.5 text-xs text-neutral-800 animate-in fade-in zoom-in-95 duration-150">
              {LINE_HEIGHT_OPTIONS.map((lh) => (
                <button
                  key={lh.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onApplyLineHeight?.(lh.value);
                    setCurrentLineHeight(lh.value);
                    setActiveMenu(null);
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer ${
                    currentLineHeight === lh.value ? 'bg-neutral-100 font-semibold text-neutral-950' : ''
                  }`}
                >
                  <span>{lh.label}</span>
                  {currentLineHeight === lh.value && <Check className="w-3 h-3 text-neutral-900 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden sm:block w-[1px] h-4 bg-neutral-200 mx-0.5 shrink-0" />

        {/* Inline Character Formatting: Bold, Italic, Underline, Strikethrough */}
        <div className="flex items-center gap-0.5 shrink-0 bg-neutral-100/80 rounded-full p-0.5 border border-neutral-200/60">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('bold')}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.bold
                ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                : 'text-neutral-600 hover:text-neutral-950'
            }`}
            title="Жирний (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('italic')}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.italic
                ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                : 'text-neutral-600 hover:text-neutral-950'
            }`}
            title="Курсив (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('underline')}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.underline
                ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                : 'text-neutral-600 hover:text-neutral-950'
            }`}
            title="Підкреслений (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('strikeThrough')}
            className={`hidden sm:flex w-7 h-7 items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.strikethrough
                ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                : 'text-neutral-600 hover:text-neutral-950'
            }`}
            title="Закреслений"
          >
            <Strikethrough className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Text Color Popover */}
        <div className="relative shrink-0 hidden sm:block">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('textColor')}
            className={`w-7 h-7 flex flex-col items-center justify-center rounded-full transition-all cursor-pointer ${
              activeMenu === 'textColor' ? 'bg-neutral-200 text-neutral-950' : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Колір тексту"
          >
            <Baseline className="w-3.5 h-3.5" strokeWidth={2} />
            <span
              className="w-3 h-0.5 rounded-full mt-[1px] transition-colors"
              style={{ backgroundColor: textColor || '#171717' }}
            />
          </button>

          {activeMenu === 'textColor' && (
            <TextColorPalette
              currentColor={textColor}
              onSelectColor={(col) => {
                onChangeTextColor?.(col);
                setActiveMenu(null);
              }}
              onClose={() => setActiveMenu(null)}
            />
          )}
        </div>

        {/* Highlight Color Popover */}
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('highlightColor')}
            className={`w-7 h-7 flex flex-col items-center justify-center rounded-full transition-all cursor-pointer ${
              activeMenu === 'highlightColor' ? 'bg-neutral-200 text-neutral-950' : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Маркер виділення"
          >
            <Highlighter className="w-3.5 h-3.5" strokeWidth={2} />
            {highlightColor && highlightColor !== 'transparent' && (
              <span
                className="w-3 h-0.5 rounded-full mt-[1px] transition-colors"
                style={{ backgroundColor: highlightColor }}
              />
            )}
          </button>

          {activeMenu === 'highlightColor' && (
            <HighlightColorPalette
              currentColor={highlightColor}
              onSelectColor={(col) => {
                onChangeHighlightColor?.(col);
                setActiveMenu(null);
              }}
              onClose={() => setActiveMenu(null)}
            />
          )}
        </div>

        <div className="hidden sm:block w-[1px] h-4 bg-neutral-200 mx-0.5 shrink-0" />

        {/* Alignment Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('align')}
            className={`w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer ${
              activeMenu === 'align' ? 'bg-neutral-200 text-neutral-950' : 'hover:bg-neutral-100'
            }`}
            title="Вирівнювання тексту"
          >
            {activeFormats.justifyCenter ? (
              <AlignCenter className="w-3.5 h-3.5" strokeWidth={2} />
            ) : activeFormats.justifyRight ? (
              <AlignRight className="w-3.5 h-3.5" strokeWidth={2} />
            ) : activeFormats.justifyFull ? (
              <AlignJustify className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <AlignLeft className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </button>

          {activeMenu === 'align' && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 w-36 flex flex-col gap-0.5 text-xs text-neutral-800 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExecCommand?.('justifyLeft');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <AlignLeft className="w-3.5 h-3.5 text-neutral-500" />
                <span>По лівому</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExecCommand?.('justifyCenter');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <AlignCenter className="w-3.5 h-3.5 text-neutral-500" />
                <span>По центру</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExecCommand?.('justifyRight');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <AlignRight className="w-3.5 h-3.5 text-neutral-500" />
                <span>По правому</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExecCommand?.('justifyFull');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <AlignJustify className="w-3.5 h-3.5 text-neutral-500" />
                <span>По ширині</span>
              </button>
            </div>
          )}
        </div>

        {/* Lists */}
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('insertUnorderedList')}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.insertUnorderedList
                ? 'bg-neutral-200 text-neutral-950 font-bold'
                : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Маркований список"
          >
            <List className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('insertOrderedList')}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.insertOrderedList
                ? 'bg-neutral-200 text-neutral-950 font-bold'
                : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Нумерований список"
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Blockquote & Code */}
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormatBlock?.('blockquote')}
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Цитата"
          >
            <Quote className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormatBlock?.('pre')}
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Блок коду"
          >
            <Code className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Subscript & Superscript */}
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('subscript')}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.subscript
                ? 'bg-neutral-200 text-neutral-950 font-bold'
                : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Підрядковий індекс (H₂O)"
          >
            <Subscript className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecCommand?.('superscript')}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              activeFormats.superscript
                ? 'bg-neutral-200 text-neutral-950 font-bold'
                : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Надрядковий індекс (x²)"
          >
            <Superscript className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Clear Formatting */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClearFormatting}
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
          title="Очистити форматування"
        >
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>

        <div className="hidden sm:block w-[1px] h-4 bg-neutral-200 mx-0.5 shrink-0" />

        {/* Inserts: Link, Image, Table, Anchor */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenLinkModal}
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Вставити посилання"
          >
            <Link2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Вставити фото"
          >
            <ImageIcon className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsertTable?.(3, 3)}
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Вставити таблицю 3x3"
          >
            <TableIcon className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onInsertAnchor}
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Вставити якір навігації"
          >
            <Anchor className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Export Dropdown (Icon Only) */}
        <div className="relative shrink-0 hidden sm:block">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('export')}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeMenu === 'export'
                ? 'bg-neutral-200 text-neutral-950'
                : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
            }`}
            title="Експорт нотатки"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>

          {activeMenu === 'export' && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 w-38 flex flex-col gap-0.5 text-xs text-neutral-800 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExport?.('markdown');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExport?.('html');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-neutral-500" />
                <span>HTML (.html)</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onExport?.('txt');
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-neutral-100 text-left transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                <span>Text (.txt)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT: NOTE ACTION BUTTONS ================= */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 pl-1 border-l border-neutral-200/60 ml-1">
        <button
          type="button"
          onClick={onCopyText}
          title={copiedPreviewText ? 'Скопійовано!' : 'Скопіювати текст нотатки'}
          aria-label="Скопіювати текст"
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <AnimatedCopyIcon isCopied={copiedPreviewText} className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => onTogglePin(note.id, e)}
          title={note.pinned ? 'Відкріпити' : 'Закріпити'}
          aria-label={note.pinned ? 'Відкріпити' : 'Закріпити'}
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <AnimatedPinIcon isPinned={!!note.pinned} className="w-3.5 h-3.5" />
        </button>

        {/* Note Color Marker Popover Button (placed right next to the Pin icon) */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => toggleMenu('noteMarkerColor')}
            title={
              note.markerColor || note.marked
                ? 'Колір маркера нотатки'
                : 'Маркувати нотатку кольором'
            }
            aria-label="Маркер нотатки"
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer relative ${
              activeMenu === 'noteMarkerColor'
                ? 'bg-neutral-200 text-neutral-950 ring-1 ring-neutral-300'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Palette className="w-3.5 h-3.5" strokeWidth={1.8} />
            {(note.markerColor || note.marked) && (
              <span
                className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full border border-white shadow-2xs"
                style={{ backgroundColor: note.markerColor || '#171717' }}
              />
            )}
          </button>

          {activeMenu === 'noteMarkerColor' && (
            <NoteMarkerColorPalette
              currentColor={note.markerColor || (note.marked ? '#171717' : null)}
              onSelectColor={(color) => {
                onChangeNoteMarkerColor?.(color);
                setActiveMenu(null);
              }}
              onClose={() => setActiveMenu(null)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={(e) => onDeleteNote(note.id, e)}
          title="Видалити нотатку"
          aria-label="Видалити нотатку"
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <AnimatedTrashIcon className="w-3.5 h-3.5" />
        </button>

        {onOpenVaultSetup && (
          <button
            type="button"
            onClick={onOpenVaultSetup}
            title={isVaultProtected ? 'Захищено сейфом' : 'Налаштувати безпеку сейфу'}
            aria-label="Безпека сейфу"
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <AnimatedLockIcon isLocked={isVaultProtected} className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
