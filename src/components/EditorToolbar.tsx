import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
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
  Sparkles,
  Baseline,
  Highlighter,
  Eraser,
  Undo,
  Redo,
  Download,
  FileText,
  Code2,
  Type,
  ChevronDown,
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
  onOpenLinkModal: () => void;
  onInsertImageFile: (file: File) => void;
  onInsertAnchor?: () => void;
  onAutoPartitionAnchors?: () => void;
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
  onOpenLinkModal,
  onInsertImageFile,
  onInsertAnchor,
  onAutoPartitionAnchors,
  onInsertTable,
  onExport,
  textColor,
  onChangeTextColor,
  highlightColor,
  onChangeHighlightColor,
  isSidebarCollapsed = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [currentFontName, setCurrentFontName] = useState('Times New Roman');
  const [currentFontSize, setCurrentFontSize] = useState('16px');

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (fontMenuRef.current && !fontMenuRef.current.contains(target)) {
        setShowFontMenu(false);
      }
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(target)) {
        setShowSizeMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
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
        // ignore in unattached selection environments
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImageFile(file);
      e.target.value = '';
    }
  };

  return (
    <div
      id="editor-toolbar"
      className="w-full bg-white select-none border-b border-neutral-100/80 relative z-30 flex items-center px-4 sm:px-6 py-2 min-h-[46px] transition-all duration-200"
    >
      {/* Left spacer / sidebar toggle clearance */}
      <div className="w-8 sm:w-12 shrink-0" />

      {/* Main Formatting Toolbar - Single-line, centered above editor */}
      <div className="flex-1 flex items-center justify-center overflow-visible">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap overflow-visible">
          {/* Font Family Dropdown */}
          <div ref={fontMenuRef} className="relative shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowFontMenu(!showFontMenu);
                setShowSizeMenu(false);
              }}
              className="h-7 px-2 flex items-center gap-1 text-xs font-normal text-neutral-700 hover:text-neutral-950 transition-colors"
              title="Шрифт"
            >
              <span className="truncate max-w-[100px] sm:max-w-[120px]" style={{ fontFamily: currentFontName }}>
                {currentFontName}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" strokeWidth={1.75} />
            </button>

            {showFontMenu && (
              <div
                className="absolute left-0 top-full mt-1.5 w-52 max-h-72 overflow-y-auto bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
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
                    className={`w-full px-3 py-1.5 text-xs text-left transition-colors flex items-center justify-between ${
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
              </div>
            )}
          </div>

          {/* Font Size Dropdown */}
          <div ref={sizeMenuRef} className="relative shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowSizeMenu(!showSizeMenu);
                setShowFontMenu(false);
              }}
              className="h-7 px-1.5 flex items-center gap-0.5 text-xs text-neutral-700 hover:text-neutral-950 transition-colors"
              title="Розмір шрифту"
            >
              <span>{currentFontSize}</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" strokeWidth={1.75} />
            </button>

            {showSizeMenu && (
              <div
                className="absolute left-0 top-full mt-1.5 w-24 max-h-60 overflow-y-auto bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
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
                    className={`w-full px-3 py-1 text-xs text-left transition-colors ${
                      currentFontSize === size
                        ? 'text-neutral-950 font-bold bg-neutral-50'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-[1px] h-4 bg-neutral-200 mx-0.5 shrink-0" />

          {/* Basic Text Formatting */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('bold')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.bold ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Жирний (Ctrl+B)"
              aria-label="Жирний"
            >
              <Bold className="w-4 h-4" strokeWidth={activeFormats.bold ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('italic')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.italic ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Курсив (Ctrl+I)"
              aria-label="Курсив"
            >
              <Italic className="w-4 h-4" strokeWidth={activeFormats.italic ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('underline')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.underline ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Підкреслення (Ctrl+U)"
              aria-label="Підкреслення"
            >
              <Underline className="w-4 h-4" strokeWidth={activeFormats.underline ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('strikeThrough')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.strikeThrough ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Закреслення"
              aria-label="Закреслення"
            >
              <Strikethrough className="w-4 h-4" strokeWidth={activeFormats.strikeThrough ? 2.75 : 1.75} />
            </button>
          </div>

          {/* Headings and Paragraphs */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('H1')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors font-semibold text-xs ${
                activeFormats.h1 ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Заголовок 1"
              aria-label="Заголовок 1"
            >
              <Heading1 className="w-4 h-4" strokeWidth={activeFormats.h1 ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('H2')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors font-semibold text-xs ${
                activeFormats.h2 ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Заголовок 2"
              aria-label="Заголовок 2"
            >
              <Heading2 className="w-4 h-4" strokeWidth={activeFormats.h2 ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('H3')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors font-semibold text-xs ${
                activeFormats.h3 ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Заголовок 3"
              aria-label="Заголовок 3"
            >
              <Heading3 className="w-4 h-4" strokeWidth={activeFormats.h3 ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('P')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.p ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Звичайний текст"
              aria-label="Звичайний текст"
            >
              <Pilcrow className="w-4 h-4" strokeWidth={activeFormats.p ? 2.75 : 1.75} />
            </button>
          </div>

          {/* Lists, Quote, Code */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('insertUnorderedList')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.insertUnorderedList ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Маркований список"
              aria-label="Маркований список"
            >
              <List className="w-4 h-4" strokeWidth={activeFormats.insertUnorderedList ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('insertOrderedList')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.insertOrderedList ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Нумерований список"
              aria-label="Нумерований список"
            >
              <ListOrdered className="w-4 h-4" strokeWidth={activeFormats.insertOrderedList ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('BLOCKQUOTE')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.blockquote ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Цитата"
              aria-label="Цитата"
            >
              <Quote className="w-4 h-4" strokeWidth={activeFormats.blockquote ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onFormatBlock('PRE')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.pre ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Блок коду"
              aria-label="Блок коду"
            >
              <Code className="w-4 h-4" strokeWidth={activeFormats.pre ? 2.75 : 1.75} />
            </button>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('justifyLeft')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.justifyLeft ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Вирівняти ліворуч"
              aria-label="Вирівняти ліворуч"
            >
              <AlignLeft className="w-4 h-4" strokeWidth={activeFormats.justifyLeft ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('justifyCenter')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.justifyCenter ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Вирівняти по центру"
              aria-label="Вирівняти по центру"
            >
              <AlignCenter className="w-4 h-4" strokeWidth={activeFormats.justifyCenter ? 2.75 : 1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('justifyRight')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                activeFormats.justifyRight ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Вирівняти праворуч"
              aria-label="Вирівняти праворуч"
            >
              <AlignRight className="w-4 h-4" strokeWidth={activeFormats.justifyRight ? 2.75 : 1.75} />
            </button>
          </div>

          {/* Links, Media & Table */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenLinkModal}
              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Вставити посилання"
              aria-label="Вставити посилання"
            >
              <Link2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 transition-colors"
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
                className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                title="Вставити якір (розділювач із назвою)"
                aria-label="Вставити якір"
              >
                <Anchor className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            {onAutoPartitionAnchors && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAutoPartitionAnchors();
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                title="Автоматично розставити якорі розділів"
                aria-label="Автоматично розставити якорі розділів"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
            {onInsertTable && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onInsertTable();
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
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
              className="relative w-7 h-7 flex items-center justify-center rounded cursor-pointer text-neutral-600 hover:text-neutral-900 transition-colors"
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
              className="relative w-7 h-7 flex items-center justify-center rounded cursor-pointer text-neutral-600 hover:text-neutral-900 transition-colors"
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
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('removeFormat')}
              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Очистити форматування"
              aria-label="Очистити форматування"
            >
              <Eraser className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Undo & Redo */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('undo')}
              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Скасувати (Ctrl+Z)"
              aria-label="Скасувати"
            >
              <Undo className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onExecCommand('redo')}
              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Повторити (Ctrl+Y)"
              aria-label="Повторити"
            >
              <Redo className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Export dropdown separated to the right side */}
      <div ref={exportMenuRef} className="shrink-0 relative ml-2">
        <button
          type="button"
          onClick={() => setShowExportMenu(!showExportMenu)}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            showExportMenu ? 'text-neutral-950 font-bold' : 'text-neutral-600 hover:text-neutral-900'
          }`}
          title="Експорт нотатки"
          aria-label="Експорт нотатки"
        >
          <Download className="w-4 h-4" strokeWidth={showExportMenu ? 2.75 : 1.75} />
        </button>

        {showExportMenu && (
          <div
            className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-neutral-200/90 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onClick={() => {
                onExport('markdown');
                setShowExportMenu(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.75} />
              <span>Експорт у Markdown</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onExport('html');
                setShowExportMenu(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.75} />
              <span>Експорт у HTML</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onExport('txt');
                setShowExportMenu(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.75} />
              <span>Експорт у TXT</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
