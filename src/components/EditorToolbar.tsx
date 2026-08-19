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
} from 'lucide-react';
import { TextFormatCommand, BlockFormatCommand } from '../types';

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
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onExecCommand,
  onFormatBlock,
  onApplyFontFamily,
  onApplyFontSize,
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontBtnRef = useRef<HTMLButtonElement>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  const [fontMenuPos, setFontMenuPos] = useState({ top: 0, left: 0 });
  const [sizeMenuPos, setSizeMenuPos] = useState({ top: 0, left: 0 });
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, left: 0 });

  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [currentFontName, setCurrentFontName] = useState('Times New Roman');
  const [currentFontSize, setCurrentFontSize] = useState('16px');

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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImageFile(file);
      e.target.value = '';
    }
  };

  const getBtnClass = (isActive: boolean) =>
    `w-7 h-7 shrink-0 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
      isActive
        ? 'bg-neutral-200/80 text-neutral-950'
        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
    }`;

  const Divider = () => <div className="w-px h-4 bg-neutral-200/80 mx-0.5 sm:mx-1 shrink-0 select-none" />;

  return (
    <div
      id="editor-toolbar"
      className="flex items-center gap-0.5 sm:gap-1 flex-nowrap select-none shrink-0"
    >
      {/* 1. Typography: Font Family & Font Size */}
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
          <Type className="w-4 h-4" strokeWidth={1.75} />
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
          <span className="text-[14px] font-semibold leading-none select-none">
            A
          </span>
        </button>
      </div>

      <Divider />

      {/* 2. Basic Text Formatting */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('bold')}
          className={getBtnClass(!!activeFormats.bold)}
          title="Жирний (Ctrl+B)"
          aria-label="Жирний"
        >
          <Bold className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('italic')}
          className={getBtnClass(!!activeFormats.italic)}
          title="Курсив (Ctrl+I)"
          aria-label="Курсив"
        >
          <Italic className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('underline')}
          className={getBtnClass(!!activeFormats.underline)}
          title="Підкреслення (Ctrl+U)"
          aria-label="Підкреслення"
        >
          <Underline className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('strikeThrough')}
          className={getBtnClass(!!activeFormats.strikeThrough)}
          title="Закреслення"
          aria-label="Закреслення"
        >
          <Strikethrough className="w-4 h-4" strokeWidth={1.75} />
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
      </div>

      <Divider />

      {/* 3. Headings and Paragraphs */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormatBlock('H1')}
          className={getBtnClass(!!activeFormats.h1)}
          title="Заголовок 1"
          aria-label="Заголовок 1"
        >
          <Heading1 className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormatBlock('H2')}
          className={getBtnClass(!!activeFormats.h2)}
          title="Заголовок 2"
          aria-label="Заголовок 2"
        >
          <Heading2 className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormatBlock('H3')}
          className={getBtnClass(!!activeFormats.h3)}
          title="Заголовок 3"
          aria-label="Заголовок 3"
        >
          <Heading3 className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormatBlock('P')}
          className={getBtnClass(!!activeFormats.p)}
          title="Звичайний текст"
          aria-label="Звичайний текст"
        >
          <Pilcrow className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <Divider />

      {/* 4. Lists, Quote, Code */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('insertUnorderedList')}
          className={getBtnClass(!!activeFormats.insertUnorderedList)}
          title="Маркований список"
          aria-label="Маркований список"
        >
          <List className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('insertOrderedList')}
          className={getBtnClass(!!activeFormats.insertOrderedList)}
          title="Нумерований список"
          aria-label="Нумерований список"
        >
          <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormatBlock('BLOCKQUOTE')}
          className={getBtnClass(!!activeFormats.blockquote)}
          title="Цитата"
          aria-label="Цитата"
        >
          <Quote className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormatBlock('PRE')}
          className={getBtnClass(!!activeFormats.pre)}
          title="Блок коду"
          aria-label="Блок коду"
        >
          <Code className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <Divider />

      {/* 5. Alignment */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('justifyLeft')}
          className={getBtnClass(!!activeFormats.justifyLeft)}
          title="Вирівняти ліворуч"
          aria-label="Вирівняти ліворуч"
        >
          <AlignLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('justifyCenter')}
          className={getBtnClass(!!activeFormats.justifyCenter)}
          title="Вирівняти по центру"
          aria-label="Вирівняти по центру"
        >
          <AlignCenter className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExecCommand('justifyRight')}
          className={getBtnClass(!!activeFormats.justifyRight)}
          title="Вирівняти праворуч"
          aria-label="Вирівняти праворуч"
        >
          <AlignRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <Divider />

      {/* 6. Links, Media & Table */}
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

      <Divider />

      {/* 7. Colors & Highlight */}
      <div className="flex items-center gap-0.5 shrink-0">
        <label
          className="relative w-7 h-7 shrink-0 flex items-center justify-center rounded-md cursor-pointer text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 transition-colors"
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
          className="relative w-7 h-7 shrink-0 flex items-center justify-center rounded-md cursor-pointer text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 transition-colors"
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

      <Divider />

      {/* 8. Undo & Redo */}
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

      <Divider />

      {/* 9. Export dropdown */}
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
          <Download className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

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

