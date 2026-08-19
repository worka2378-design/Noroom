import React, { useRef, useEffect, useState, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FileText, Plus, Anchor, Check, Info } from 'lucide-react';
import { Note, TextFormatCommand, BlockFormatCommand } from '../types';
import { TableEditorManager } from './TableEditorManager';
import { AnchorVerticalRail } from './AnchorNavigator';
import { formatNoteDate, countWords, countCharacters } from '../utils/storage';
import { createGraphicLinkHtml, autoConvertUrlsToRichLinks } from '../utils/links';
import { autoPartitionNoteWithAnchors, cleanLegacyAnchorDividers, extractNoteSections } from '../utils/sections';
import { FloatingScrollbar } from './FloatingScrollbar';

export interface EditorPaneHandle {
  execCommand: (command: TextFormatCommand, value?: string) => void;
  formatBlock: (tag: BlockFormatCommand) => void;
  applyFontFamily: (fontFamily: string) => void;
  applyFontSize: (fontSize: string) => void;
  applyLineHeight: (lineHeight: string) => void;
  clearFormatting: () => void;
  insertImageFile: (file: File) => void;
  insertAnchor: () => void;
  autoPartitionAnchors: () => void;
  insertTable: (rows?: number, cols?: number) => void;
  exportNote: (format: 'markdown' | 'html' | 'txt') => void;
  changeTextColor: (color: string) => void;
  changeHighlightColor: (color: string) => void;
}

export interface EditorPaneProps {
  note: Note | null;
  targetAnchorId?: string | null;
  onUpdateNote: (updates: Partial<Note>) => void;
  onCreateNote: () => void;
  onOpenLinkModal: () => void;
  textColor: string;
  onChangeTextColor: (color: string) => void;
  highlightColor: string;
  onChangeHighlightColor: (color: string) => void;
  isSidebarCollapsed?: boolean;
  onTyping?: () => void;
  onSelectionChange?: (hasSelection: boolean) => void;
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(({
  note,
  targetAnchorId,
  onUpdateNote,
  onCreateNote,
  onOpenLinkModal,
  textColor,
  onChangeTextColor,
  highlightColor,
  onChangeHighlightColor,
  isSidebarCollapsed = false,
  onTyping,
  onSelectionChange,
}, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const documentFrameRef = useRef<HTMLDivElement>(null);

  // Active section tracker for vertical rail dots
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Dynamic Anchor indicator for headings on click / cursor focus
  const [activeHeadingInfo, setActiveHeadingInfo] = useState<{
    element: HTMLElement;
    top: number;
    anchorId: string;
    copied: boolean;
  } | null>(null);

  // Toggleable Word & Character Statistics Popover
  const [showStats, setShowStats] = useState(false);
  const statsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-collapse stats popover when clicked outside
  useEffect(() => {
    if (!showStats) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (statsContainerRef.current && !statsContainerRef.current.contains(e.target as Node)) {
        setShowStats(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showStats]);

  const updateActiveHeading = useCallback(() => {
    const editor = contentRef.current;
    if (!editor) {
      setActiveHeadingInfo(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setActiveHeadingInfo(null);
      return;
    }

    const node = selection.anchorNode;
    if (!node || !editor.contains(node)) {
      setActiveHeadingInfo(null);
      return;
    }

    // Traverse upwards from anchorNode to check if inside H1..H6
    let curr: Node | null = node;
    let headingEl: HTMLElement | null = null;

    while (curr && curr !== editor) {
      if (curr.nodeType === Node.ELEMENT_NODE) {
        const el = curr as HTMLElement;
        if (/^H[1-6]$/i.test(el.tagName)) {
          headingEl = el;
          break;
        }
      }
      curr = curr.parentNode;
    }

    if (headingEl && editor.contains(headingEl)) {
      let aId = headingEl.getAttribute('data-anchor-id') || headingEl.id;
      if (!aId) {
        aId = 'anchor-' + Math.random().toString(36).substring(2, 9);
        headingEl.id = aId;
        headingEl.setAttribute('data-anchor-id', aId);
      }

      const container = editor.parentElement;
      if (container) {
        const hRect = headingEl.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const relativeTop = hRect.top - cRect.top + hRect.height / 2;

        setActiveHeadingInfo((prev) => ({
          element: headingEl!,
          top: relativeTop,
          anchorId: aId,
          copied: prev?.element === headingEl ? prev.copied : false,
        }));
      }
    } else {
      setActiveHeadingInfo(null);
    }
  }, []);

  const handleCopyAnchorFromHeading = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeHeadingInfo) return;

    setActiveSectionId(activeHeadingInfo.anchorId);

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(`#${activeHeadingInfo.anchorId}`).catch(() => {});
    }

    setActiveHeadingInfo((prev) => (prev ? { ...prev, copied: true } : null));
    setTimeout(() => {
      setActiveHeadingInfo((prev) => (prev ? { ...prev, copied: false } : null));
    }, 1500);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveHeading();

      // Check if user has selected text in editor
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.toString().trim().length > 0) {
        const node = sel.anchorNode;
        if (node && contentRef.current && contentRef.current.contains(node)) {
          onSelectionChange?.(true);
          return;
        }
      }
      onSelectionChange?.(false);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', updateActiveHeading);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', updateActiveHeading);
    };
  }, [updateActiveHeading, onSelectionChange]);

  // Extracted sections for active note
  const sections = useMemo(() => {
    if (!note) return [];
    return extractNoteSections(note.content, note.title);
  }, [note?.content, note?.title]);

  const scrollToSection = (sectionId: string, index?: number) => {
    const frame = document.getElementById('editor-document-frame') as HTMLElement | null;
    const editor = contentRef.current;

    if (sectionId === 'section-root' || sectionId === 'note-top' || index === 0) {
      if (frame) {
        frame.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveSectionId('section-root');
      return;
    }

    if (!editor || !frame) return;

    let targetEl: HTMLElement | null = null;

    // 1. By ID selector
    try {
      targetEl = editor.querySelector(`#${CSS.escape(sectionId)}`) as HTMLElement | null;
    } catch {
      targetEl = null;
    }

    // 2. By data-anchor-id attribute
    if (!targetEl) {
      try {
        targetEl = editor.querySelector(`[data-anchor-id="${CSS.escape(sectionId)}"]`) as HTMLElement | null;
      } catch {
        targetEl = null;
      }
    }

    // 3. By matching section title text
    const sectionObj = sections.find((s) => s.id === sectionId) || (index !== undefined ? sections[index] : null);
    const targetTitle = sectionObj?.title?.trim().toLowerCase();

    if (!targetEl && targetTitle) {
      const candidates = Array.from(
        editor.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-anchor-title], p, div, li, blockquote')
      ) as HTMLElement[];

      for (const el of candidates) {
        const titleAttr = (el.getAttribute('data-anchor-title') || '').trim().toLowerCase();
        const text = (el.textContent || '').trim().toLowerCase();
        if (
          titleAttr === targetTitle ||
          text === targetTitle ||
          (text.length < 150 && (text.startsWith(targetTitle) || targetTitle.startsWith(text)))
        ) {
          targetEl = el;
          break;
        }
      }
    }

    // 4. By sequential index among headings / anchored blocks
    if (!targetEl && index !== undefined && index > 0) {
      const headingsAndAnchors = Array.from(
        editor.querySelectorAll('h1, h2, h3, h4, [data-anchor-id], [id^="anchor-"]')
      ) as HTMLElement[];
      if (headingsAndAnchors[index - 1]) {
        targetEl = headingsAndAnchors[index - 1];
      } else {
        const blocks = (Array.from(editor.children) as HTMLElement[]).filter((c) => (c.textContent || '').trim().length > 0);
        if (blocks[index]) {
          targetEl = blocks[index];
        }
      }
    }

    if (targetEl) {
      const frameRect = frame.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const scrollOffset = targetRect.top - frameRect.top;
      const targetScrollTop = frame.scrollTop + scrollOffset - 24;

      frame.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });

      setActiveSectionId(sectionId);
    }
  };

  const handleDocumentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const frame = e.currentTarget;
    const editor = contentRef.current;
    if (!editor || sections.length <= 1) return;

    // 1. Near the very top
    if (frame.scrollTop < 60) {
      setActiveSectionId(sections[0].id);
      return;
    }

    // 2. Near the bottom of document -> activate the last section
    if (frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 40) {
      setActiveSectionId(sections[sections.length - 1].id);
      return;
    }

    const frameRect = frame.getBoundingClientRect();
    const threshold = 180; // offset line from top of viewport

    let currentActiveId = sections[0].id;

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      let el: HTMLElement | null = null;

      try {
        el = editor.querySelector(`#${CSS.escape(section.id)}, [data-anchor-id="${CSS.escape(section.id)}"]`) as HTMLElement | null;
      } catch {
        el = null;
      }

      if (!el && section.title) {
        const targetTitle = section.title.trim().toLowerCase();
        const candidates = Array.from(editor.querySelectorAll('h1, h2, h3, h4, h5, [data-anchor-title], p')) as HTMLElement[];
        el = candidates.find((h) => {
          const t = (h.getAttribute('data-anchor-title') || h.textContent || '').trim().toLowerCase();
          return t === targetTitle || (t.length < 120 && (t.startsWith(targetTitle) || targetTitle.startsWith(t)));
        }) || null;
      }

      if (!el) {
        const headingsAndAnchors = Array.from(
          editor.querySelectorAll('h1, h2, h3, h4, [data-anchor-id], [id^="anchor-"]')
        ) as HTMLElement[];
        if (headingsAndAnchors[i - 1]) {
          el = headingsAndAnchors[i - 1];
        }
      }

      if (el) {
        const rect = el.getBoundingClientRect();
        // If this section has scrolled into or above the threshold
        if (rect.top - frameRect.top <= threshold) {
          currentActiveId = section.id;
        }
      }
    }

    setActiveSectionId(currentActiveId);
    updateActiveHeading();
  };

  // Sync content when active note changes
  useEffect(() => {
    if (contentRef.current && note) {
      const currentHtml = contentRef.current.innerHTML;
      const noteHtml = note.content || '';
      if (currentHtml !== noteHtml) {
        contentRef.current.innerHTML = cleanLegacyAnchorDividers(autoConvertUrlsToRichLinks(noteHtml));
      }
    }
  }, [note?.id]);

  // Smooth scroll and pulse highlight when targetAnchorId is specified
  useEffect(() => {
    if (!targetAnchorId || !contentRef.current) return;

    const timer = setTimeout(() => {
      const editor = contentRef.current;
      if (!editor) return;

      let targetEl: HTMLElement | null = null;

      // 1. Try finding by direct ID
      try {
        targetEl = editor.querySelector(`#${CSS.escape(targetAnchorId)}`) as HTMLElement | null;
      } catch {
        targetEl = null;
      }

      // 2. Try finding by data-anchor-id
      if (!targetEl) {
        try {
          targetEl = editor.querySelector(`[data-anchor-id="${CSS.escape(targetAnchorId)}"]`) as HTMLElement | null;
        } catch {
          targetEl = null;
        }
      }

      // 3. Try finding by anchor title/label or heading match
      if (!targetEl) {
        const potentialElements = Array.from(
          editor.querySelectorAll('.note-anchor-block, h1, h2, h3, p, div')
        ) as HTMLElement[];

        const q = targetAnchorId.toLowerCase();
        for (const el of potentialElements) {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes(q)) {
            targetEl = el.closest('.note-anchor-block') as HTMLElement || el;
            break;
          }
        }
      }

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [targetAnchorId, note?.id]);

  // Enhanced Word & Google Docs compatible Copy listener for Tables
  useEffect(() => {
    const editor = contentRef.current;
    if (!editor) return;

    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      // Only customize clipboard if the selection actually contains table elements or cells
      const range = selection.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());

      const tables = container.querySelectorAll('table');
      const cells = container.querySelectorAll('td, th');

      // If tables or table cells are selected, style them cleanly for Word / Excel / Google Docs export
      if (tables.length > 0 || cells.length > 0) {
        tables.forEach((tbl) => {
          tbl.style.borderCollapse = 'collapse';
          tbl.style.border = '1px solid #000000';
          tbl.style.fontFamily = "'Times New Roman', 'Tinos', Times, Georgia, serif";
          tbl.style.fontSize = '14px';
          tbl.style.margin = '12px 0';
          tbl.setAttribute('border', '1');
        });

        container.querySelectorAll('tr').forEach((row) => {
          row.style.border = '1px solid #000000';
        });

        cells.forEach((cell) => {
          const el = cell as HTMLElement;
          el.style.border = '1px solid #000000';
          el.style.padding = '6px 10px';
          el.style.verticalAlign = 'top';
        });

        // Strip UI controls if present
        container.querySelectorAll('.table-editor-ui-control, .anchor-delete-btn').forEach((el) => el.remove());

        const htmlData = container.innerHTML;
        const textData = container.textContent || container.innerText || '';

        if (htmlData && textData && e.clipboardData) {
          e.preventDefault();
          e.clipboardData.setData('text/html', htmlData);
          e.clipboardData.setData('text/plain', textData);
        }
      }
      // For all regular text, paragraphs, headings: browser native copy will cleanly and reliably copy the selection
    };

    editor.addEventListener('copy', handleCopy);
    return () => {
      editor.removeEventListener('copy', handleCopy);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTyping?.();
    onUpdateNote({ title: e.target.value });
  };

  const handleContentInput = () => {
    onTyping?.();
    if (contentRef.current) {
      onUpdateNote({ content: contentRef.current.innerHTML });
    }
  };

  const handleInsertTable = (rows = 3, cols = 3) => {
    const editor = contentRef.current;
    if (!editor) return;

    // Create 3x3 table element with high-contrast, clean 1px borders
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.border = '1px solid #1c1917';
    table.style.margin = '16px 0';
    table.setAttribute('border', '1');

    const tbody = document.createElement('tbody');
    const colWidth = (100 / cols).toFixed(2);

    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const isHeader = r === 0;
        const cell = document.createElement(isHeader ? 'th' : 'td');
        cell.style.border = '1px solid #1c1917';
        cell.style.padding = '8px 12px';
        cell.style.width = `${colWidth}%`;
        cell.style.minWidth = '40px';
        cell.style.height = '36px';
        cell.style.verticalAlign = 'top';
        if (isHeader) {
          cell.style.fontWeight = '600';
          cell.style.backgroundColor = '#f9fafb';
        }
        // Use a break line so cell has height and can be clicked into
        cell.innerHTML = '<br>';
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const trailingP = document.createElement('p');
    trailingP.innerHTML = '<br>';

    editor.focus();

    const sel = window.getSelection();
    let inserted = false;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(trailingP);
        range.insertNode(table);
        inserted = true;
      }
    }

    if (!inserted) {
      editor.appendChild(table);
      editor.appendChild(trailingP);
    }

    // Persist content change to parent note state
    onUpdateNote({ content: editor.innerHTML });

    // Focus into first cell
    setTimeout(() => {
      const firstCell = table.querySelector('th, td') as HTMLElement | null;
      if (firstCell) {
        firstCell.focus();
        const newSel = window.getSelection();
        if (newSel) {
          const newRange = document.createRange();
          newRange.selectNodeContents(firstCell);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      }
    }, 20);
  };

  const handleInsertAnchor = () => {
    const editor = contentRef.current;
    if (!editor) return;

    let initialLabel = 'Розділ';
    const sel = window.getSelection();
    let targetBlock: HTMLElement | null = null;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const selectedText = sel.toString().trim();
      if (selectedText && selectedText.length <= 40) {
        initialLabel = selectedText;
      }

      let node: Node | null = range.startContainer;
      while (node && node !== editor) {
        if (node.nodeType === 1) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (['p', 'h1', 'h2', 'h3', 'h4', 'div', 'li', 'blockquote'].includes(tag)) {
            targetBlock = el;
            break;
          }
        }
        node = node.parentNode;
      }
    }

    const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);

    if (targetBlock) {
      targetBlock.id = anchorId;
      targetBlock.setAttribute('data-anchor-id', anchorId);
      targetBlock.setAttribute('data-anchor-title', initialLabel);
    } else {
      const p = document.createElement('p');
      p.id = anchorId;
      p.setAttribute('data-anchor-id', anchorId);
      p.setAttribute('data-anchor-title', initialLabel);
      p.textContent = initialLabel;
      editor.appendChild(p);
    }

    editor.focus();
    onUpdateNote({ content: editor.innerHTML });
    setActiveSectionId(anchorId);
  };

  const handleAutoPartitionAnchors = (force = true) => {
    const editor = contentRef.current;
    if (!editor) return;

    const currentHtml = editor.innerHTML;
    const { updatedHtml, addedCount } = autoPartitionNoteWithAnchors(currentHtml, {
      force,
      minWords: 25,
    });

    if (addedCount > 0) {
      editor.innerHTML = updatedHtml;
      onUpdateNote({ content: updatedHtml });
    }
  };

  const handleContentBlur = () => {
    // Normal blur handler - do not inject artificial partitions
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain').trim();
    // Check if the pasted text is a single URL
    const urlPattern = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;
    if (urlPattern.test(text)) {
      e.preventDefault();
      const richHtml = createGraphicLinkHtml(text);
      document.execCommand('insertHTML', false, richHtml);
      handleContentInput();
      return;
    }

    // For any standard paste (text, rich HTML, tables), ensure content change is saved
    setTimeout(() => {
      handleContentInput();
    }, 10);
  };

  const handleCut = () => {
    setTimeout(() => {
      handleContentInput();
    }, 10);
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Handle anchor delete button click
    const deleteBtn = target.closest('.anchor-delete-btn') as HTMLElement | null;
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const anchorBlock = deleteBtn.closest('.note-anchor-block');
      if (anchorBlock) {
        anchorBlock.remove();
        handleContentInput();
      }
      return;
    }

    const linkEl = target.closest('a') as HTMLAnchorElement | null;
    if (linkEl) {
      const href = linkEl.getAttribute('href') || linkEl.dataset.url;
      if (href) {
        if (href.startsWith('#')) {
          e.preventDefault();
          const targetAnchor = contentRef.current?.querySelector(href) as HTMLElement | null;
          if (targetAnchor) {
            targetAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        // Open URL in new window/tab
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onTyping?.();

    // Clear formatting shortcut (Ctrl+\ or Ctrl+Shift+X or Meta+\)
    if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || (e.shiftKey && (e.key === 'X' || e.key === 'x')))) {
      e.preventDefault();
      handleClearFormatting();
      return;
    }

    if (e.key === 'Enter') {
      const selection = window.getSelection();
      let node: Node | null = selection?.anchorNode || null;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const anchorLabel = (node as HTMLElement | null)?.closest('.anchor-label');
      if (anchorLabel) {
        e.preventDefault();
        const anchorBlock = anchorLabel.closest('.note-anchor-block');
        if (anchorBlock) {
          let nextP = anchorBlock.nextElementSibling as HTMLElement | null;
          if (!nextP) {
            nextP = document.createElement('p');
            nextP.innerHTML = '<br>';
            anchorBlock.parentElement?.appendChild(nextP);
          }
          const range = document.createRange();
          range.selectNodeContents(nextP);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
          nextP.focus();
        }
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const selection = window.getSelection();
      let td: HTMLTableCellElement | null = null;
      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode;
        td = (node as HTMLElement | null)?.closest('td, th') || null;
      }

      if (td) {
        const tr = td.parentElement as HTMLTableRowElement | null;
        const table = td.closest('table') as HTMLTableElement | null;
        if (tr && table) {
          const cells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
          const currentIndex = cells.indexOf(td);

          if (e.shiftKey) {
            // Move to previous cell
            if (currentIndex > 0) {
              const prevCell = cells[currentIndex - 1];
              prevCell.focus();
              const range = document.createRange();
              range.selectNodeContents(prevCell);
              range.collapse(false);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          } else {
            // Move to next cell
            if (currentIndex < cells.length - 1) {
              const nextCell = cells[currentIndex + 1];
              nextCell.focus();
              const range = document.createRange();
              range.selectNodeContents(nextCell);
              range.collapse(false);
              selection?.removeAllRanges();
              selection?.addRange(range);
            } else {
              // Word behavior: In the last cell of the table, Tab adds a new row!
              const newRow = table.insertRow(-1);
              const colCount = table.rows[0]?.cells.length || 3;
              for (let i = 0; i < colCount; i++) {
                const newCell = newRow.insertCell(i);
                newCell.innerHTML = '&nbsp;';
                newCell.style.border = '1px solid #1c1917';
                newCell.style.padding = '6px 10px';
                newCell.style.minWidth = '36px';
                newCell.style.verticalAlign = 'top';
                const firstRowCell = table.rows[0]?.cells[i];
                if (firstRowCell?.style?.width) {
                  newCell.style.width = firstRowCell.style.width;
                }
              }
              const firstNewCell = newRow.cells[0];
              if (firstNewCell) {
                firstNewCell.focus();
                const range = document.createRange();
                range.selectNodeContents(firstNewCell);
                range.collapse(false);
                selection?.removeAllRanges();
                selection?.addRange(range);
              }
              handleContentInput();
            }
          }
          return;
        }
      }

      document.execCommand('insertText', false, '    ');
      handleContentInput();
      return;
    }

    // When pressing space or enter, check if user just typed a URL to automatically convert it
    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => {
        if (!contentRef.current) return;
        const selection = window.getSelection();
        if (!selection || !selection.focusNode) return;
        
        const textContent = selection.focusNode.textContent || '';
        const rawUrlRegex = /(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)$/i;
        const match = rawUrlRegex.exec(textContent.trim());
        if (match && selection.focusNode.parentElement?.tagName !== 'A') {
          const converted = autoConvertUrlsToRichLinks(contentRef.current.innerHTML);
          if (converted !== contentRef.current.innerHTML) {
            contentRef.current.innerHTML = converted;
            handleContentInput();
          }
        }
      }, 10);
    }
  };

  const handleClearFormatting = () => {
    const editor = contentRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      document.execCommand('removeFormat', false);
      handleContentInput();
      return;
    }

    if (selection.isCollapsed) {
      // If cursor is at a point, remove format for current typing context and reset block if heading/quote
      document.execCommand('removeFormat', false);
      document.execCommand('unlink', false);
      document.execCommand('formatBlock', false, '<p>');
      handleContentInput();
      return;
    }

    // 1. Convert lists to normal paragraphs if selected
    try {
      if (document.queryCommandState('insertUnorderedList')) {
        document.execCommand('insertUnorderedList', false);
      }
      if (document.queryCommandState('insertOrderedList')) {
        document.execCommand('insertOrderedList', false);
      }
    } catch {
      // ignore
    }

    // 2. Standard document commands
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    document.execCommand('formatBlock', false, '<p>');

    // 3. Clean any remaining inline style attributes, colors, highlights, font sizes on selected nodes
    try {
      const range = selection.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }

      if (container && editor.contains(container)) {
        const isSelectedOrDescendant = (node: Node) => range.intersectsNode(node);

        const styledElements = Array.from(
          (container as HTMLElement).querySelectorAll('*')
        ).filter(isSelectedOrDescendant) as HTMLElement[];

        if (container !== editor && isSelectedOrDescendant(container)) {
          styledElements.push(container as HTMLElement);
        }

        styledElements.forEach((el) => {
          const tag = el.tagName.toLowerCase();

          // If wrapper tags that only provide formatting
          if (['span', 'font', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'mark'].includes(tag)) {
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
              }
              parent.removeChild(el);
            }
          } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tag)) {
            const p = document.createElement('p');
            p.innerHTML = el.innerHTML;
            el.parentNode?.replaceChild(p, el);
          } else if (tag !== 'table' && tag !== 'tbody' && tag !== 'thead' && tag !== 'tr' && tag !== 'td' && tag !== 'th') {
            el.removeAttribute('style');
            el.removeAttribute('class');
            el.removeAttribute('color');
            el.removeAttribute('face');
            el.removeAttribute('size');
          }
        });
      }
    } catch (err) {
      console.warn('Error during clear formatting:', err);
    }

    editor.normalize();
    handleContentInput();
  };

  const handleExecCommand = (command: TextFormatCommand, value: string = '') => {
    if (contentRef.current) {
      contentRef.current.focus();
      if (command === 'removeFormat') {
        handleClearFormatting();
        return;
      }
      document.execCommand(command, false, value || undefined);
      handleContentInput();
    }
  };

  const handleApplyFontFamily = (fontFamily: string) => {
    if (contentRef.current) {
      contentRef.current.focus();
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('fontName', false, fontFamily);
      handleContentInput();
    }
  };

  const handleApplyFontSize = (fontSize: string) => {
    if (contentRef.current) {
      contentRef.current.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      if (!selection.isCollapsed) {
        document.execCommand('styleWithCSS', false, 'true');
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = fontSize;
        try {
          span.appendChild(range.extractContents());
          range.insertNode(span);
          selection.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          selection.addRange(newRange);
        } catch {
          document.execCommand('fontSize', false, '3');
        }
      }
      handleContentInput();
    }
  };

  const handleApplyLineHeight = (lineHeight: string) => {
    const editor = contentRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const blocks = Array.from(
        editor.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div.note-anchor-block')
      ) as HTMLElement[];

      let applied = false;
      for (const block of blocks) {
        if (range.intersectsNode(block) || selection.containsNode(block, true)) {
          block.style.lineHeight = lineHeight;
          applied = true;
        }
      }

      if (!applied) {
        let node: Node | null = selection.anchorNode;
        if (node && editor.contains(node)) {
          if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
          const block = (node as HTMLElement | null)?.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div') as HTMLElement | null;
          if (block && editor.contains(block) && block !== editor) {
            block.style.lineHeight = lineHeight;
            applied = true;
          }
        }
      }

      if (!applied) {
        editor.style.lineHeight = lineHeight;
      }
    } else {
      editor.style.lineHeight = lineHeight;
    }

    handleContentInput();
  };

  const handleFormatBlock = (tag: BlockFormatCommand) => {
    if (contentRef.current) {
      contentRef.current.focus();
      document.execCommand('formatBlock', false, tag);
      handleContentInput();
    }
  };

  const handleInsertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && contentRef.current) {
        contentRef.current.focus();
        document.execCommand('insertImage', false, reader.result);
        handleContentInput();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExport = (format: 'markdown' | 'html' | 'txt') => {
    if (!note) return;

    let contentToExport = '';
    let filename = `${note.title.trim() || 'Нотатка'}`;
    let mimeType = 'text/plain;charset=utf-8';

    if (format === 'html') {
      contentToExport = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>${note.title || 'Нотатка'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Fira+Code:wght@300..700&family=JetBrains+Mono:ital,wght@0,300..800;1,300..800&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Montserrat:ital,wght@0,300..800;1,300..800&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,700&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Times New Roman', 'Tinos', Times, Georgia, serif; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.75; color: #1b1c1e; }
    h1 { font-size: 28px; margin-top: 24px; margin-bottom: 8px; font-weight: 700; }
    h2 { font-size: 22px; margin-top: 20px; margin-bottom: 6px; font-weight: 700; }
    h3 { font-size: 18px; margin-top: 16px; margin-bottom: 4px; font-weight: 600; }
    blockquote { border-left: 2px solid #1b1c1e; padding-left: 14px; color: #666; font-style: italic; margin: 16px 0; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code', monospace; }
    img { max-width: 100%; border-radius: 6px; }
    a { color: #1b1c1e; text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${note.title || 'Без назви'}</h1>
  ${note.content || ''}
</body>
</html>`;
      filename += '.html';
      mimeType = 'text/html;charset=utf-8';
    } else if (format === 'markdown') {
      // Basic HTML to Markdown conversion
      const temp = document.createElement('div');
      temp.innerHTML = note.content || '';
      
      let md = `# ${note.title || 'Без назви'}\n\n`;
      // Replace headers, anchors, bold, italics, links
      temp.querySelectorAll('.note-anchor-block').forEach((el) => {
        const name = el.querySelector('.anchor-label')?.textContent?.trim() || 'Якір';
        const id = el.getAttribute('id') || '';
        el.outerHTML = `\n<a id="${id}"></a>\n---\n**⚓ ${name}**\n---\n`;
      });
      temp.querySelectorAll('h1').forEach((el) => (el.outerHTML = `\n# ${el.textContent}\n`));
      temp.querySelectorAll('h2').forEach((el) => (el.outerHTML = `\n## ${el.textContent}\n`));
      temp.querySelectorAll('h3').forEach((el) => (el.outerHTML = `\n### ${el.textContent}\n`));
      temp.querySelectorAll('b, strong').forEach((el) => (el.outerHTML = `**${el.textContent}**`));
      temp.querySelectorAll('i, em').forEach((el) => (el.outerHTML = `*${el.textContent}*`));
      temp.querySelectorAll('blockquote').forEach((el) => (el.outerHTML = `\n> ${el.textContent}\n`));
      temp.querySelectorAll('pre, code').forEach((el) => (el.outerHTML = `\n\`\`\`\n${el.textContent}\n\`\`\`\n`));
      temp.querySelectorAll('a').forEach((el) => (el.outerHTML = `[${el.textContent}](${el.getAttribute('href')})`));
      temp.querySelectorAll('li').forEach((el) => (el.outerHTML = `- ${el.textContent}\n`));
      
      md += (temp.textContent || '').trim();
      contentToExport = md;
      filename += '.md';
    } else {
      const temp = document.createElement('div');
      temp.innerHTML = note.content || '';
      contentToExport = `${note.title || 'Без назви'}\n\n${temp.textContent || ''}`;
      filename += '.txt';
    }

    const blob = new Blob([contentToExport], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  useImperativeHandle(ref, () => ({
    execCommand: handleExecCommand,
    formatBlock: handleFormatBlock,
    applyFontFamily: handleApplyFontFamily,
    applyFontSize: handleApplyFontSize,
    applyLineHeight: handleApplyLineHeight,
    clearFormatting: handleClearFormatting,
    insertImageFile: handleInsertImageFile,
    insertAnchor: handleInsertAnchor,
    autoPartitionAnchors: () => handleAutoPartitionAnchors(true),
    insertTable: (rows?: number, cols?: number) => handleInsertTable(rows || 3, cols || 3),
    exportNote: handleExport,
    changeTextColor: (color: string) => {
      onChangeTextColor(color);
      if (contentRef.current) {
        contentRef.current.focus();
        document.execCommand('foreColor', false, color);
        handleContentInput();
      }
    },
    changeHighlightColor: (color: string) => {
      onChangeHighlightColor(color);
      if (contentRef.current) {
        contentRef.current.focus();
        document.execCommand('hiliteColor', false, color);
        handleContentInput();
      }
    },
  }));

  if (!note) {
    return (
      <main id="editor-empty-state" className="flex-1 flex flex-col items-center justify-center p-8 bg-white text-neutral-400 select-none">
        <FileText className="w-12 h-12 text-neutral-200 mb-3" strokeWidth={1.75} />
        <p className="text-sm font-medium text-neutral-500 mb-4">
          Оберіть нотатку зі списку або створіть нову
        </p>
        <button
          type="button"
          onClick={onCreateNote}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          <span>Нова нотатка</span>
        </button>
      </main>
    );
  }

  const words = countWords(note.content);
  const chars = countCharacters(note.content);

  return (
    <main id="editor-main-pane" className="flex-1 flex flex-col min-w-0 bg-white relative">
      {/* Floating minimal scrollbar in anchor dot style (when note does not have multiple sections) */}
      {sections.length <= 1 && (
        <FloatingScrollbar
          containerRef={documentFrameRef}
          rightOffsetClass="right-3 sm:right-6"
          dotSizeClass="w-1.5 h-1.5"
          topPadding={68}
          bottomPadding={32}
        />
      )}

      {/* Document Workspace (Scrolls under the seamless translucent header) */}
      <div
        ref={documentFrameRef}
        id="editor-document-frame"
        onScroll={handleDocumentScroll}
        className="flex-1 overflow-y-auto scrollbar-none px-6 sm:px-12 md:px-16 pt-16 sm:pt-20 pb-24"
      >
        <div className="max-w-3xl mx-auto relative">
          {/* Interactive Table Editor Overlay (Word-like resizing, +/- rows/cols, Word copy) */}
          <TableEditorManager
            editorRef={contentRef}
            onContentChange={handleContentInput}
          />

          {/* Note Title Input */}
          <div className="flex items-center gap-2 mb-6">
            <input
              ref={titleInputRef}
              id="editor-title-input"
              type="text"
              value={note.title}
              onChange={handleTitleChange}
              onFocus={() => onTyping?.()}
              onKeyDown={() => onTyping?.()}
              placeholder="Назва нотатки"
              className="flex-1 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none"
            />
          </div>

          {/* Dynamic Section Anchor Indicator on Heading Focus/Click */}
          {activeHeadingInfo && (
            <div
              id="active-heading-anchor-badge"
              style={{ top: `${activeHeadingInfo.top}px` }}
              className="absolute -left-7 sm:-left-8 -translate-y-1/2 flex items-center z-20 transition-all duration-150"
            >
              <button
                type="button"
                onClick={handleCopyAnchorFromHeading}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shadow-2xs border border-neutral-200/80 bg-white cursor-pointer group"
                title={activeHeadingInfo.copied ? 'Якір скопійовано!' : 'Якір розділу'}
                aria-label="Якір розділу"
              >
                {activeHeadingInfo.copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                ) : (
                  <Anchor className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-400 group-hover:text-neutral-900" strokeWidth={1.75} />
                )}
              </button>
            </div>
          )}

          {/* Note Rich Content Editable */}
          <div
            ref={contentRef}
            id="editor-content-area"
            contentEditable
            suppressContentEditableWarning
            onFocus={() => onTyping?.()}
            onInput={handleContentInput}
            onBlur={handleContentBlur}
            onKeyDown={handleKeyDown}
            onKeyUp={updateActiveHeading}
            onPaste={handlePaste}
            onCut={handleCut}
            onClick={(e) => {
              handleContentClick(e);
              setTimeout(updateActiveHeading, 10);
            }}
            data-placeholder="Почніть писати…"
            className="editor-typography outline-none text-neutral-800 text-base leading-relaxed min-h-[400px]"
          />
        </div>
      </div>

      {/* Vertical Anchor Rail Navigator (Dots) */}
      <AnchorVerticalRail
        sections={sections}
        activeSectionId={activeSectionId}
        onNavigateToSection={scrollToSection}
      />

      {/* Floating Document Statistics Icon & Popover */}
      <div
        ref={statsContainerRef}
        id="editor-stats-container"
        className="fixed bottom-4 right-6 z-20 flex items-center gap-2 select-none"
      >
        {showStats && (
          <div
            id="editor-stats-details"
            className="animate-in fade-in slide-in-from-right-2 duration-150 flex items-center gap-2 text-[11px] text-neutral-600 font-medium bg-white/85 backdrop-blur-md border border-neutral-200/80 shadow-xs px-3 py-1.5 rounded-full"
          >
            <span>{words} слів</span>
            <span className="text-neutral-300">·</span>
            <span>{chars} симв.</span>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-500">збережено {formatNoteDate(note.updated)}</span>
          </div>
        )}

        <button
          id="editor-stats-toggle-btn"
          type="button"
          onClick={() => setShowStats((prev) => !prev)}
          title={showStats ? 'Сховати статистику нотатки' : 'Статистика нотатки (слова, символи)'}
          aria-label="Статистика нотатки"
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            showStats ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-800'
          }`}
        >
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={showStats ? 2.5 : 1.75} />
        </button>
      </div>
    </main>
  );
});
