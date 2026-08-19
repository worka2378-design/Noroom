import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Link2,
  Image as ImageIcon,
  Anchor,
  Baseline,
  Highlighter,
  Undo,
  Redo,
  Download,
  FileText,
  Code2,
  Type,
  Table as TableIcon,
  ChevronRight,
  MoveVertical,
  Check,
} from 'lucide-react';
import { TextFormatCommand, BlockFormatCommand } from '../types';

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

interface EditorToolbarProps {
  onExecCommand: (command: TextFormatCommand, value?: string) => void;
  onFormatBlock: (tag: BlockFormatCommand) => void;
  onApplyFontFamily?: (fontFamily: string) => void;
  onApplyFontSize?: (fontSize: string) => void;
  onApplyLineHeight?: (lineHeight: string) => void;
  onClearFormatting?: () => void;
  onOpenLinkModal: () => void;
  onInsertImageFile: (file: File) => void;
  onInsertAnchor?: () => void;
  onInsertTable?: () => void;
  onExport: (format: 'markdown' | 'html' | 'txt') => void;
  textColor: string;
  onChangeTextColor: (color: string) => void;
  highlightColor: string;
  onChangeHighlightColor: (color: string) => void;
  isSidebarCollapsed?: boolean;
  onMenuOpenChange?: (isOpen: boolean) => void;
  isTyping?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
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
  textColor,
  onChangeTextColor,
  highlightColor,
  onChangeHighlightColor,
  onMenuOpenChange,
  isTyping = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontBtnRef = useRef<HTMLButtonElement>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const lineHeightBtnRef = useRef<HTMLButtonElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const lineHeightDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showLineHeightMenu, setShowLineHeightMenu] = useState(false);

  const [fontMenuPos, setFontMenuPos] = useState({ top: 0, left: 0 });
  const [sizeMenuPos, setSizeMenuPos] = useState({ top: 0, left: 0 });
  const [lineHeightMenuPos, setLineHeightMenuPos] = useState({ top: 0, left: 0 });
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, left: 0 });

  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [currentFontName, setCurrentFontName] = useState('Times New Roman');
  const [currentFontSize, setCurrentFontSize] = useState('16px');
  const [currentLineHeight, setCurrentLineHeight] = useState('1.5');
  const [isExpanded, setIsExpanded] = useState(false);

  const isAnyMenuOpen = showFontMenu || showSizeMenu || showExportMenu || showLineHeightMenu;
  useEffect(() => {
    onMenuOpenChange?.(isAnyMenuOpen);
  }, [isAnyMenuOpen, onMenuOpenChange]);

  // Option A: Auto-collapse secondary tools back to compact 4-button mode when resuming typing
  useEffect(() => {
    if (isTyping && !isAnyMenuOpen) {
      setIsExpanded(false);
    }
  }, [isTyping, isAnyMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        fontBtnRef.current &&
        !fontBtnRef.current.contains(target) &&
        (!fontDropdownRef.current || !fontDropdownRef.current.contains(target))
      ) {
        setShowFontMenu(false);
      }
      if (
        sizeBtnRef.current &&
        !sizeBtnRef.current.contains(target) &&
        (!sizeDropdownRef.current || !sizeDropdownRef.current.contains(target))
      ) {
        setShowSizeMenu(false);
      }
      if (
        lineHeightBtnRef.current &&
        !lineHeightBtnRef.current.contains(target) &&
        (!lineHeightDropdownRef.current || !lineHeightDropdownRef.current.contains(target))
      ) {
        setShowLineHeightMenu(false);
      }
      if (
        exportBtnRef.current &&
        !exportBtnRef.current.contains(target) &&
        (!exportDropdownRef.current || !exportDropdownRef.current.contains(target))
      ) {
        setShowExportMenu(false);
      }
    };

    const handleWindowChange = () => {
      setShowFontMenu(false);
      setShowSizeMenu(false);
      setShowLineHeightMenu(false);
      setShowExportMenu(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, []);

  useEffect(() => {
    const updateActiveFormats = () => {
      try {
        const formats: Record<string, boolean> = {
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikeThrough: document.queryCommandState('strikeThrough'),
          insertUnorderedList: document.queryCommandState('insertUnorderedList'),
          insertOrderedList: document.queryCommandState('insertOrderedList'),
          justifyLeft: document.queryCommandState('justifyLeft'),
          justifyCenter: document.queryCommandState('justifyCenter'),
          justifyRight: document.queryCommandState('justifyRight'),
        };

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          let node: Node | null = selection.anchorNode;
          if (node && node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
          }
          const el = node as HTMLElement | null;
          if (el) {
            const h1 = !!el.closest('h1');
            const h2 = !!el.closest('h2');
            const h3 = !!el.closest('h3');
            const blockquote = !!el.closest('blockquote');
            const pre = !!el.closest('pre');
            const p = !h1 && !h2 && !h3 && !blockquote && !pre && !!el.closest('#editor-content-area');
            formats.h1 = h1;
            formats.h2 = h2;
            formats.h3 = h3;
            formats.p = p;
            formats.blockquote = blockquote;
            formats.pre = pre;

            // Detect font family & size
            const computed = window.getComputedStyle(el);
            const fontFamily = computed.fontFamily.toLowerCase();
            const matchedFont = FONT_OPTIONS.find((f) =>
              fontFamily.includes(f.name.toLowerCase()) || fontFamily.includes(f.name.split(' ')[0].toLowerCase())
            );
            if (matchedFont) {
              setCurrentFontName(matchedFont.name);
            }

            if (computed.fontSize) {
              setCurrentFontSize(Math.round(parseFloat(computed.fontSize)) + 'px');
            }

            // Detect line-height
            const lh = el.style.lineHeight || computed.lineHeight;
            if (lh) {
              const matched = LINE_HEIGHT_OPTIONS.find((opt) => opt.value === lh);
              if (matched) {
                setCurrentLineHeight(matched.short);
              }
            }
          }
        }

        setActiveFormats(formats);
      } catch {
        // ignore
      }
    };

    document.addEventListener('selectionchange', updateActiveFormats);
    document.addEventListener('keyup', updateActiveFormats);
    document.addEventListener('mouseup', updateActiveFormats);
    return () => {
      document.removeEventListener('selectionchange', updateActiveFormats);
      document.removeEventListener('keyup', updateActiveFormats);
      document.removeEventListener('mouseup', updateActiveFormats);
    };
  }, []);

  const handleToggleFontMenu = () => {
    if (!showFontMenu && fontBtnRef.current) {
      const rect = fontBtnRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 216));
      setFontMenuPos({ top: rect.bottom + 6, left });
    }
    setShowFontMenu((prev) => !prev);
    setShowSizeMenu(false);
    setShowExportMenu(false);
  };

  const handleToggleSizeMenu = () => {
    if (!showSizeMenu && sizeBtnRef.current) {
      const rect = sizeBtnRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 104));
      setSizeMenuPos({ top: rect.bottom + 6, left });
    }
    setShowSizeMenu((prev) => !prev);
    setShowFontMenu(false);
    setShowLineHeightMenu(false);
    setShowExportMenu(false);
  };

  const handleToggleLineHeightMenu = () => {
    if (!showLineHeightMenu && lineHeightBtnRef.current) {
      const rect = lineHeightBtnRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 180));
      setLineHeightMenuPos({ top: rect.bottom + 6, left });
    }
    setShowLineHeightMenu((prev) => !prev);
    setShowFontMenu(false);
    setShowSizeMenu(false);
    setShowExportMenu(false);
  };

  const handleToggleExportMenu = () => {
    if (!showExportMenu && exportBtnRef.current) {
      const rect = exportBtnRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188));
      setExportMenuPos({ top: rect.bottom + 6, left });
    }
    setShowExportMenu((prev) => !prev);
    setShowFontMenu(false);
    setShowSizeMenu(false);
    setShowLineHeightMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImageFile(file);
      e.target.value = '';
    }
  };

  const getBtnClass = (isActive: boolean) =>
    `w-7 h-7 shrink-0 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
      isActive
        ? 'text-neutral-950 font-bold hover:bg-neutral-200/50'
        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
    }`;

  return (
    <div
      id="editor-toolbar"
      className={`inline-flex items-center gap-0.5 sm:gap-1 p-1 bg-white/75 backdrop-blur-md border border-neutral-200/80 shadow-2xs rounded-full transition-all duration-300 ease-out select-none shrink-0 ${
        isExpanded ? 'max-w-full' : 'max-w-max'
      }`}
    >
      {/* ================= PRIMARY ESSENTIAL TOOLS ================= */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('bold')}
          className={getBtnClass(!!activeFormats.bold)}
          title="Жирний (Ctrl+B)"
          aria-label="Жирний"
        >
          <Bold className="w-4 h-4" strokeWidth={activeFormats.bold ? 2.5 : 1.75} />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('italic')}
          className={getBtnClass(!!activeFormats.italic)}
          title="Курсив (Ctrl+I)"
          aria-label="Курсив"
        >
          <Italic className="w-4 h-4" strokeWidth={activeFormats.italic ? 2.5 : 1.75} />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('insertUnorderedList')}
          className={getBtnClass(!!activeFormats.insertUnorderedList)}
          title="Маркований список"
          aria-label="Маркований список"
        >
          <List className="w-4 h-4" strokeWidth={activeFormats.insertUnorderedList ? 2.5 : 1.75} />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (onClearFormatting) {
              onClearFormatting();
            } else {
              onExecCommand('removeFormat');
            }
          }}
          className={getBtnClass(false)}
          title="Очистити форматування"
          aria-label="Очистити форматування"
        >
          <RemoveFormatting className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Sleek Gray Arrow (Expands / Collapses Secondary Tools) */}
        <button
          id="toolbar-expand-toggle-btn"
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full transition-colors cursor-pointer ml-0.5 ${
            isExpanded
              ? 'text-neutral-950 hover:bg-neutral-200/50'
              : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50'
          }`}
          title={isExpanded ? 'Згорнути інструменти' : 'Більше інструментів'}
          aria-label={isExpanded ? 'Згорнути інструменти' : 'Більше інструментів'}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? 'rotate-180 text-neutral-900' : 'text-neutral-400'
            }`}
            strokeWidth={isExpanded ? 2.5 : 2}
          />
        </button>
      </div>

      {/* ================= EXPANDED SECONDARY TOOLS ================= */}
      {isExpanded && (
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 animate-in fade-in slide-in-from-left-2 duration-200 pr-0.5">
          <div className="w-px h-3.5 bg-neutral-200/80 mx-0.5 shrink-0 select-none" />

          {/* Typography: Font Family & Font Size */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              ref={fontBtnRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleFontMenu}
              className={getBtnClass(showFontMenu)}
              title={`Шрифт: ${currentFontName}`}
              aria-label="Вибір шрифту"
            >
              <Type className="w-4 h-4" strokeWidth={showFontMenu ? 2.5 : 1.75} />
            </button>

            <button
              ref={sizeBtnRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleSizeMenu}
              className={getBtnClass(showSizeMenu)}
              title={`Розмір шрифту: ${currentFontSize}`}
              aria-label="Розмір шрифту"
            >
              <span className={`text-[14px] leading-none select-none ${showSizeMenu ? 'font-black' : 'font-semibold'}`}>
                A
              </span>
            </button>
          </div>

          {/* Extra Text Styling: Underline & Strikethrough */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('underline')}
              className={getBtnClass(!!activeFormats.underline)}
              title="Підкреслення (Ctrl+U)"
              aria-label="Підкреслення"
            >
              <Underline className="w-4 h-4" strokeWidth={activeFormats.underline ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('strikeThrough')}
              className={getBtnClass(!!activeFormats.strikeThrough)}
              title="Закреслення"
              aria-label="Закреслення"
            >
              <Strikethrough className="w-4 h-4" strokeWidth={activeFormats.strikeThrough ? 2.5 : 1.75} />
            </button>
          </div>

          {/* Headings and Paragraphs */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('H1')}
              className={getBtnClass(!!activeFormats.h1)}
              title="Заголовок 1"
              aria-label="Заголовок 1"
            >
              <Heading1 className="w-4 h-4" strokeWidth={activeFormats.h1 ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('H2')}
              className={getBtnClass(!!activeFormats.h2)}
              title="Заголовок 2"
              aria-label="Заголовок 2"
            >
              <Heading2 className="w-4 h-4" strokeWidth={activeFormats.h2 ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('H3')}
              className={getBtnClass(!!activeFormats.h3)}
              title="Заголовок 3"
              aria-label="Заголовок 3"
            >
              <Heading3 className="w-4 h-4" strokeWidth={activeFormats.h3 ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('P')}
              className={getBtnClass(!!activeFormats.p)}
              title="Звичайний текст"
              aria-label="Звичайний текст"
            >
              <Pilcrow className="w-4 h-4" strokeWidth={activeFormats.p ? 2.5 : 1.75} />
            </button>
          </div>

          {/* Lists, Quote, Code */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('insertOrderedList')}
              className={getBtnClass(!!activeFormats.insertOrderedList)}
              title="Нумерований список"
              aria-label="Нумерований список"
            >
              <ListOrdered className="w-4 h-4" strokeWidth={activeFormats.insertOrderedList ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('BLOCKQUOTE')}
              className={getBtnClass(!!activeFormats.blockquote)}
              title="Цитата"
              aria-label="Цитата"
            >
              <Quote className="w-4 h-4" strokeWidth={activeFormats.blockquote ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('PRE')}
              className={getBtnClass(!!activeFormats.pre)}
              title="Блок коду"
              aria-label="Блок коду"
            >
              <Code className="w-4 h-4" strokeWidth={activeFormats.pre ? 2.5 : 1.75} />
            </button>
          </div>

          {/* Alignment & Line Spacing */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('justifyLeft')}
              className={getBtnClass(!!activeFormats.justifyLeft)}
              title="Вирівняти ліворуч"
              aria-label="Вирівняти ліворуч"
            >
              <AlignLeft className="w-4 h-4" strokeWidth={activeFormats.justifyLeft ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('justifyCenter')}
              className={getBtnClass(!!activeFormats.justifyCenter)}
              title="Вирівняти по центру"
              aria-label="Вирівняти по центру"
            >
              <AlignCenter className="w-4 h-4" strokeWidth={activeFormats.justifyCenter ? 2.5 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('justifyRight')}
              className={getBtnClass(!!activeFormats.justifyRight)}
              title="Вирівняти праворуч"
              aria-label="Вирівняти праворуч"
            >
              <AlignRight className="w-4 h-4" strokeWidth={activeFormats.justifyRight ? 2.5 : 1.75} />
            </button>
            <button
              ref={lineHeightBtnRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleLineHeightMenu}
              className={getBtnClass(showLineHeightMenu)}
              title={`Міжрядковий інтервал (${currentLineHeight})`}
              aria-label="Міжрядковий інтервал"
            >
              <MoveVertical className="w-4 h-4" strokeWidth={showLineHeightMenu ? 2.5 : 1.75} />
            </button>
          </div>

          {/* Links, Media & Table */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenLinkModal}
              className={getBtnClass(false)}
              title="Вставити посилання"
              aria-label="Вставити посилання"
            >
              <Link2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={getBtnClass(false)}
              title="Вставити зображення"
              aria-label="Вставити зображення"
            >
              <ImageIcon className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {onInsertAnchor && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onInsertAnchor();
                }}
                className={getBtnClass(false)}
                title="Вставити якір (розділювач із назвою)"
                aria-label="Вставити якір"
              >
                <Anchor className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            {onInsertTable && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onInsertTable();
                }}
                className={getBtnClass(false)}
                title="Вставити таблицю (3х3)"
                aria-label="Вставити таблицю"
              >
                <TableIcon className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Colors & Highlight */}
          <div className="flex items-center gap-0.5 shrink-0">
            <label
              className="relative w-7 h-7 shrink-0 flex items-center justify-center rounded-full cursor-pointer text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors"
              title="Колір тексту"
            >
              <Baseline className="w-4 h-4" strokeWidth={1.75} />
              <input
                type="color"
                value={textColor}
                onChange={(e) => onChangeTextColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <label
              className="relative w-7 h-7 shrink-0 flex items-center justify-center rounded-full cursor-pointer text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors"
              title="Маркер виділення"
            >
              <Highlighter className="w-4 h-4" strokeWidth={1.75} />
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => onChangeHighlightColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Undo & Redo */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('undo')}
              className={getBtnClass(false)}
              title="Скасувати (Ctrl+Z)"
              aria-label="Скасувати"
            >
              <Undo className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('redo')}
              className={getBtnClass(false)}
              title="Повторити (Ctrl+Y)"
              aria-label="Повторити"
            >
              <Redo className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Export dropdown */}
          <div className="shrink-0 relative">
            <button
              ref={exportBtnRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleExportMenu}
              className={getBtnClass(showExportMenu)}
              title="Експорт нотатки"
              aria-label="Експорт нотатки"
            >
              <Download className="w-4 h-4" strokeWidth={showExportMenu ? 2.5 : 1.75} />
            </button>
          </div>
        </div>
      )}

      {/* ================= PORTAL DROPDOWNS (IMMUNE TO OVERFLOW CLIPPING) ================= */}
      {showFontMenu &&
        createPortal(
          <div
            ref={fontDropdownRef}
            style={{ top: `${fontMenuPos.top}px`, left: `${fontMenuPos.left}px` }}
            className="fixed w-52 max-h-72 overflow-y-auto bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-[9999] animate-in fade-in zoom-in-95 duration-100"
          >
            {FONT_OPTIONS.map((font) => (
              <button
                key={font.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCurrentFontName(font.name);
                  onApplyFontFamily?.(font.value);
                  setShowFontMenu(false);
                }}
                style={{ fontFamily: font.displayStyle }}
                className={`w-full px-3 py-1.5 text-xs text-left transition-colors flex items-center justify-between cursor-pointer ${
                  currentFontName === font.name
                    ? 'text-neutral-950 font-bold bg-neutral-50'
                    : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
                }`}
              >
                <span>{font.name}</span>
                {font.name === 'Times New Roman' && (
                  <span className="text-[10px] text-neutral-400 font-sans">TNR</span>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}

      {showSizeMenu &&
        createPortal(
          <div
            ref={sizeDropdownRef}
            style={{ top: `${sizeMenuPos.top}px`, left: `${sizeMenuPos.left}px` }}
            className="fixed w-24 max-h-60 overflow-y-auto bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-[9999] animate-in fade-in zoom-in-95 duration-100"
          >
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCurrentFontSize(size);
                  onApplyFontSize?.(size);
                  setShowSizeMenu(false);
                }}
                className={`w-full px-3 py-1 text-xs text-left transition-colors cursor-pointer ${
                  currentFontSize === size
                    ? 'text-neutral-950 font-bold bg-neutral-50'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>,
          document.body
        )}

      {showLineHeightMenu &&
        createPortal(
          <div
            ref={lineHeightDropdownRef}
            style={{ top: `${lineHeightMenuPos.top}px`, left: `${lineHeightMenuPos.left}px` }}
            className="fixed w-24 max-h-60 overflow-y-auto bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-[9999] animate-in fade-in zoom-in-95 duration-100"
          >
            {LINE_HEIGHT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCurrentLineHeight(opt.short);
                  onApplyLineHeight?.(opt.value);
                  setShowLineHeightMenu(false);
                }}
                className={`w-full px-3 py-1 text-xs text-left transition-colors cursor-pointer ${
                  currentLineHeight === opt.short
                    ? 'text-neutral-950 font-bold bg-neutral-50'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}

      {showExportMenu &&
        createPortal(
          <div
            ref={exportDropdownRef}
            style={{ top: `${exportMenuPos.top}px`, left: `${exportMenuPos.left}px` }}
            className="fixed w-44 bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-[9999] animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onExport('markdown');
                setShowExportMenu(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.75} />
              <span>Експорт у Markdown</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onExport('html');
                setShowExportMenu(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.75} />
              <span>Експорт у HTML</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onExport('txt');
                setShowExportMenu(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.75} />
              <span>Експорт у TXT</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};

