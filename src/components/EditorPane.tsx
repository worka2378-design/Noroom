import React, { useRef, useEffect, useState, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FileText, Plus, Anchor, Check } from 'lucide-react';
import { Note, TextFormatCommand, BlockFormatCommand } from '../types';
import { TableEditorManager } from './TableEditorManager';
import { AnchorVerticalRail } from './AnchorNavigator';
import { countWords, countCharacters } from '../utils/storage';
import {
  createGraphicLinkHtml,
  autoConvertUrlsToRichLinks,
  extractDomain,
  getFaviconUrl,
  formatUrlTitle,
} from '../utils/links';
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
  insertLink: (url: string) => void;
  insertPlainText: (text: string) => void;
  insertHtml: (html: string) => void;
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
  variant?: 'main' | 'deck';
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
  variant = 'main',
}, ref) => {
  const isDeck = variant === 'deck';
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

  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveHeading();

      // Check if user has selected text in editor and save range
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (contentRef.current && contentRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        }

        if (!sel.isCollapsed && sel.toString().trim().length > 0) {
          const node = sel.anchorNode;
          if (node && contentRef.current && contentRef.current.contains(node)) {
            onSelectionChange?.(true);
            return;
          }
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

  const findSectionElement = (sectionId: string, index?: number): HTMLElement | null => {
    const editor = contentRef.current;
    if (!editor) return null;

    if (sectionId === 'section-root' || sectionId === 'note-top' || index === 0) {
      return titleInputRef.current || editor;
    }

    let targetEl: HTMLElement | null = null;

    // 1. By direct ID selector
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

    // 3. If sectionId is "heading-N" (e.g. heading-0, heading-1)
    if (!targetEl && /^heading-\d+$/i.test(sectionId)) {
      const matchIdx = parseInt(sectionId.replace(/^heading-/i, ''), 10);
      const allHeadings = Array.from(
        editor.querySelectorAll('h1, h2, h3, h4, h5, h6')
      ) as HTMLElement[];
      if (!isNaN(matchIdx) && allHeadings[matchIdx]) {
        targetEl = allHeadings[matchIdx];
      }
    }

    // 4. By matching section title from sections array
    if (!targetEl) {
      const sectionObj = sections.find((s) => s.id === sectionId) || (index !== undefined ? sections[index] : null);
      if (sectionObj && sectionObj.title) {
        const targetTitle = sectionObj.title.trim().toLowerCase();
        const candidateElements = Array.from(
          editor.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-anchor-title], p, div')
        ) as HTMLElement[];

        for (const el of candidateElements) {
          const customTitle = (el.getAttribute('data-anchor-title') || '').trim().toLowerCase();
          const text = (el.textContent || '').trim().toLowerCase();
          if (
            customTitle === targetTitle ||
            text === targetTitle ||
            (text.length < 150 && (text.startsWith(targetTitle) || targetTitle.startsWith(text)))
          ) {
            targetEl = el;
            break;
          }
        }
      }
    }

    // 5. By sequential index among headings / anchors
    if (!targetEl && index !== undefined && index > 0) {
      const allHeadingsAndAnchors = Array.from(
        editor.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-anchor-id], [id^="anchor-"], [id^="heading-"]')
      ) as HTMLElement[];
      if (allHeadingsAndAnchors[index - 1]) {
        targetEl = allHeadingsAndAnchors[index - 1];
      }
    }

    return targetEl;
  };

  const scrollToSection = (sectionId: string, index?: number) => {
    const frame = documentFrameRef.current || (document.getElementById(isDeck ? 'deck-editor-document-frame' : 'editor-document-frame') as HTMLElement | null);
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

    const targetEl = findSectionElement(sectionId, index);

    if (targetEl) {
      const frameRect = frame.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const scrollOffset = targetRect.top - frameRect.top;
      const targetScrollTop = frame.scrollTop + scrollOffset - (isDeck ? 20 : 36);

      frame.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });

      // Pulse animation highlight on navigated anchor
      targetEl.classList.remove('anchor-target-pulse');
      void targetEl.offsetWidth;
      targetEl.classList.add('anchor-target-pulse');
      setTimeout(() => {
        targetEl?.classList.remove('anchor-target-pulse');
      }, 1900);

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
    const threshold = isDeck ? 120 : 180; // offset line from top of viewport

    let currentActiveId = sections[0].id;

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const el = findSectionElement(section.id, i);

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
    if (!targetAnchorId) return;

    const timer = setTimeout(() => {
      scrollToSection(targetAnchorId);
    }, 100);

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

  const convertTypedUrlAtCursor = (isSpaceKey = false): boolean => {
    const editor = contentRef.current;
    if (!editor) return false;

    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return false;

    let node: Node | null = selection.anchorNode;
    let offset = selection.anchorOffset;

    // Check if inside <a>, <pre>, <code> or anchor label
    const parentEl = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)) as HTMLElement | null;
    if (parentEl?.closest('a, pre, code, .note-anchor-block')) return false;

    if (node.nodeType !== Node.TEXT_NODE) {
      if (node.childNodes && offset > 0) {
        node = node.childNodes[offset - 1];
        if (node.nodeType === Node.TEXT_NODE) {
          offset = node.textContent?.length || 0;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    const text = node.textContent || '';
    const textBefore = text.substring(0, offset);

    // Look for URL ending right at cursor
    const urlPattern = /(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)$/i;
    const match = urlPattern.exec(isSpaceKey ? textBefore : textBefore.trimEnd());
    if (!match) return false;

    let rawUrl = match[1];
    let trailingPunct = '';
    const punctMatch = rawUrl.match(/[.,;:!?)]+$/);
    if (punctMatch) {
      trailingPunct = punctMatch[0];
      rawUrl = rawUrl.slice(0, -trailingPunct.length);
    }

    if (!rawUrl || rawUrl.length < 4) return false;

    const fullUrl = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
    const domain = extractDomain(fullUrl);
    const favicon = getFaviconUrl(domain);
    const displayTitle = formatUrlTitle(fullUrl);

    const matchStart = match.index;
    const urlLength = rawUrl.length;

    // Create rich link DOM element
    const link = document.createElement('a');
    link.href = fullUrl;
    link.className = 'rich-link';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.contentEditable = 'false';
    link.setAttribute('data-url', fullUrl);
    link.innerHTML = `<img src="${favicon}" alt="" class="rich-link-icon" onerror="this.style.display='none'" /><span>${displayTitle}</span>`;

    // Replace the URL portion of the text node using DOM range
    const range = document.createRange();
    range.setStart(node, matchStart);
    range.setEnd(node, matchStart + urlLength);
    range.deleteContents();
    range.insertNode(link);

    // If there is trailing punctuation, restore it after the link
    let insertAfterNode: Node = link;
    if (trailingPunct) {
      const punctNode = document.createTextNode(trailingPunct);
      link.parentNode?.insertBefore(punctNode, link.nextSibling);
      insertAfterNode = punctNode;
    }

    // Add trailing non-breaking space for smooth continuous typing
    const spaceNode = document.createTextNode('\u00A0');
    if (insertAfterNode.nextSibling) {
      insertAfterNode.parentNode?.insertBefore(spaceNode, insertAfterNode.nextSibling);
    } else {
      insertAfterNode.parentNode?.appendChild(spaceNode);
    }

    // Move caret after the space
    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();

    handleContentInput();
    document.dispatchEvent(new Event('selectionchange'));
    return true;
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

    // For any standard paste (text, rich HTML, tables), auto convert raw URLs if present
    setTimeout(() => {
      if (contentRef.current) {
        const currentHtml = contentRef.current.innerHTML;
        const converted = autoConvertUrlsToRichLinks(currentHtml);
        if (converted !== currentHtml) {
          contentRef.current.innerHTML = converted;
        }
      }
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
    if (e.key === ' ') {
      if (convertTypedUrlAtCursor(true)) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Enter') {
      convertTypedUrlAtCursor(false);
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

  const restoreSavedSelection = () => {
    const editor = contentRef.current;
    if (!editor) return false;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return false;

    if (savedRangeRef.current) {
      try {
        if (editor.contains(savedRangeRef.current.commonAncestorContainer)) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
          return true;
        }
      } catch {
        // Range became detached or invalid
      }
    }

    // Fallback: create a range at the end of editor
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      return true;
    } catch {
      return false;
    }
  };

  const applyStylesToDomRange = (
    range: Range,
    styles: Record<string, string>,
    editor: HTMLElement
  ) => {
    // If range is within a single text node
    if (
      range.startContainer === range.endContainer &&
      range.startContainer.nodeType === Node.TEXT_NODE
    ) {
      const textNode = range.startContainer as Text;
      const start = range.startOffset;
      const end = range.endOffset;
      if (start >= end) return;

      const parent = textNode.parentElement;
      // If the entire text node is selected and parent is a SPAN with only this text node
      if (
        parent &&
        parent !== editor &&
        parent.tagName === 'SPAN' &&
        parent.childNodes.length === 1 &&
        start === 0 &&
        end === textNode.length
      ) {
        Object.entries(styles).forEach(([prop, val]) => {
          if (val) (parent.style as any)[prop] = val;
          else if (val === '') (parent.style as any)[prop] = '';
        });
        return;
      }

      const subRange = document.createRange();
      subRange.setStart(textNode, start);
      subRange.setEnd(textNode, end);
      const extracted = subRange.extractContents();
      const span = document.createElement('span');
      Object.entries(styles).forEach(([prop, val]) => {
        if (val) (span.style as any)[prop] = val;
      });
      span.appendChild(extracted);
      subRange.insertNode(span);

      // Reselect the new span contents
      const sel = window.getSelection();
      if (sel) {
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedRangeRef.current = newRange.cloneRange();
      }
      return;
    }

    // If selection spans multiple nodes/blocks
    const ancestor = range.commonAncestorContainer;
    const rootNode =
      ancestor.nodeType === Node.TEXT_NODE
        ? ancestor.parentNode || ancestor
        : ancestor;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent || node.textContent.length === 0)
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: { node: Text; start: number; end: number }[] = [];
    let curr = walker.nextNode();
    while (curr) {
      const textNode = curr as Text;
      let start = 0;
      let end = textNode.length;
      if (textNode === range.startContainer) {
        start = range.startOffset;
      }
      if (textNode === range.endContainer) {
        end = range.endOffset;
      }
      if (start < end) {
        textNodes.push({ node: textNode, start, end });
      }
      curr = walker.nextNode();
    }

    textNodes.forEach(({ node, start, end }) => {
      const parent = node.parentElement;
      if (
        parent &&
        parent !== editor &&
        parent.tagName === 'SPAN' &&
        parent.childNodes.length === 1 &&
        start === 0 &&
        end === node.length
      ) {
        Object.entries(styles).forEach(([prop, val]) => {
          if (val) (parent.style as any)[prop] = val;
          else if (val === '') (parent.style as any)[prop] = '';
        });
        return;
      }

      const subRange = document.createRange();
      subRange.setStart(node, start);
      subRange.setEnd(node, end);
      const extracted = subRange.extractContents();
      const span = document.createElement('span');
      Object.entries(styles).forEach(([prop, val]) => {
        if (val) (span.style as any)[prop] = val;
      });
      span.appendChild(extracted);
      subRange.insertNode(span);
    });
  };

  const applyStyleToAllBlocks = (styles: Record<string, string>) => {
    const editor = contentRef.current;
    if (!editor) return;

    // Apply to editor root
    Object.entries(styles).forEach(([prop, val]) => {
      if (val) {
        (editor.style as any)[prop] = val;
      }
    });

    const blocks = editor.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div.note-anchor-block'
    );
    if (blocks.length > 0) {
      blocks.forEach((b) => {
        const el = b as HTMLElement;
        Object.entries(styles).forEach(([prop, val]) => {
          if (val) {
            (el.style as any)[prop] = val;
          }
        });
      });
    } else {
      const p = document.createElement('p');
      Object.entries(styles).forEach(([prop, val]) => {
        if (val) (p.style as any)[prop] = val;
      });
      while (editor.firstChild) {
        p.appendChild(editor.firstChild);
      }
      if (!p.textContent && !p.hasChildNodes()) {
        p.appendChild(document.createElement('br'));
      }
      editor.appendChild(p);
    }
  };

  const applyInlineStyleToSelection = (styles: {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
  }) => {
    const editor = contentRef.current;
    if (!editor) return;
    restoreSavedSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      applyStyleToAllBlocks(styles as Record<string, string>);
      handleContentInput();
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }

    const range = sel.getRangeAt(0);

    // If selection is collapsed (cursor only, no text highlighted) or not inside editor
    if (sel.isCollapsed || !editor.contains(range.commonAncestorContainer)) {
      let node: Node | null = range.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const block = (node as HTMLElement | null)?.closest(
        'p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div'
      ) as HTMLElement | null;

      if (block && editor.contains(block) && block !== editor) {
        Object.entries(styles).forEach(([prop, val]) => {
          if (val) {
            (block.style as any)[prop] = val;
          } else if (val === '') {
            (block.style as any)[prop] = '';
          }
        });
      } else {
        applyStyleToAllBlocks(styles as Record<string, string>);
      }
      handleContentInput();
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }

    // Text IS selected across range:
    try {
      applyStylesToDomRange(range, styles as Record<string, string>, editor);
      if (sel.rangeCount > 0) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    } catch (err) {
      console.warn('Could not apply inline style to selection:', err);
    }

    handleContentInput();
    document.dispatchEvent(new Event('selectionchange'));
  };

  const handleExecCommand = (command: TextFormatCommand, value: string = '') => {
    if (contentRef.current) {
      restoreSavedSelection();
      if (command === 'removeFormat') {
        handleClearFormatting();
        return;
      }
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, value || undefined);
      handleContentInput();
      document.dispatchEvent(new Event('selectionchange'));
    }
  };

  const handleApplyFontFamily = (fontFamily: string) => {
    applyInlineStyleToSelection({ fontFamily });
  };

  const handleApplyFontSize = (fontSize: string) => {
    applyInlineStyleToSelection({ fontSize });
  };

  const handleApplyLineHeight = (lineHeight: string) => {
    const editor = contentRef.current;
    if (!editor) return;
    restoreSavedSelection();

    editor.style.lineHeight = lineHeight;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const blocks = Array.from(
        editor.querySelectorAll(
          'p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div.note-anchor-block'
        )
      ) as HTMLElement[];

      let applied = false;
      for (const block of blocks) {
        if (range.intersectsNode(block) || sel.containsNode(block, true)) {
          block.style.lineHeight = lineHeight;
          applied = true;
        }
      }

      if (!applied) {
        let node: Node | null = sel.anchorNode;
        if (node && editor.contains(node)) {
          if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
          const block = (node as HTMLElement | null)?.closest(
            'p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div'
          ) as HTMLElement | null;
          if (block && editor.contains(block) && block !== editor) {
            block.style.lineHeight = lineHeight;
            applied = true;
          }
        }
      }

      if (!applied) {
        blocks.forEach((b) => {
          b.style.lineHeight = lineHeight;
        });
      }
    } else {
      let node: Node | null = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
      if (node && editor.contains(node)) {
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        const block = (node as HTMLElement | null)?.closest(
          'p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, div'
        ) as HTMLElement | null;
        if (block && editor.contains(block) && block !== editor) {
          block.style.lineHeight = lineHeight;
        }
      }
      editor
        .querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre')
        .forEach((el) => {
          (el as HTMLElement).style.lineHeight = lineHeight;
        });
    }

    handleContentInput();
    document.dispatchEvent(new Event('selectionchange'));
  };

  const handleFormatBlock = (tag: BlockFormatCommand) => {
    const editor = contentRef.current;
    if (!editor) return;
    restoreSavedSelection();

    const rawTag = tag.replace(/[<>]/g, '').toLowerCase();
    const sel = window.getSelection();

    if (!sel || sel.rangeCount === 0) {
      return;
    }

    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }
    let node: Node | null = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

    // If node is directly the editor container (e.g. naked text node)
    if (node === editor) {
      const p = document.createElement(rawTag === 'p' ? 'p' : rawTag);
      while (editor.firstChild) {
        p.appendChild(editor.firstChild);
      }
      editor.appendChild(p);
      const newRange = document.createRange();
      newRange.selectNodeContents(p);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
      handleContentInput();
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }

    const block = (node as HTMLElement | null)?.closest('p, h1, h2, h3, h4, h5, h6, blockquote, pre, div, li') as HTMLElement | null;

    if (block && editor.contains(block) && block !== editor) {
      const newBlock = document.createElement(rawTag === 'p' ? 'p' : rawTag);
      newBlock.innerHTML = block.innerHTML;
      if (block.id) newBlock.id = block.id;
      if (block.getAttribute('data-anchor-id')) {
        newBlock.setAttribute('data-anchor-id', block.getAttribute('data-anchor-id')!);
      }
      if (block.getAttribute('data-anchor-title')) {
        newBlock.setAttribute('data-anchor-title', block.getAttribute('data-anchor-title')!);
      }
      if (block.style.lineHeight) {
        newBlock.style.lineHeight = block.style.lineHeight;
      }
      if (block.style.textAlign) {
        newBlock.style.textAlign = block.style.textAlign;
      }
      block.parentNode?.replaceChild(newBlock, block);

      const newRange = document.createRange();
      newRange.selectNodeContents(newBlock);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    } else {
      try {
        document.execCommand('formatBlock', false, `<${rawTag}>`);
      } catch {
        // ignore
      }
    }

    handleContentInput();
    document.dispatchEvent(new Event('selectionchange'));
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
      applyInlineStyleToSelection({ color });
    },
    changeHighlightColor: (color: string) => {
      onChangeHighlightColor(color);
      applyInlineStyleToSelection({
        backgroundColor: color === 'transparent' ? '' : color,
      });
    },
    insertLink: (url: string) => {
      const editor = contentRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current && sel) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        } catch {
          // ignore
        }
      }
      const richHtml = createGraphicLinkHtml(url);
      document.execCommand('insertHTML', false, richHtml);
      handleContentInput();
    },
    insertPlainText: (text: string) => {
      const editor = contentRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current && sel) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        } catch {
          // ignore
        }
      }
      document.execCommand('insertText', false, text);
      handleContentInput();
    },
    insertHtml: (html: string) => {
      const editor = contentRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current && sel) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        } catch {
          // ignore
        }
      }
      document.execCommand('insertHTML', false, html);
      handleContentInput();
    },
  }));

  if (!note) {
    return (
      <main id="editor-empty-state" className="flex-1 min-w-0 min-h-0 h-full flex flex-col items-center justify-center p-8 bg-white text-neutral-400 select-none">
        <FileText className="w-12 h-12 text-neutral-200 mb-3" strokeWidth={1.75} />
        <p className="text-sm font-medium text-neutral-500 mb-4">
          Оберіть нотатку зі списку або створіть нову
        </p>
        <button
          type="button"
          onClick={onCreateNote}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300/80 rounded-full transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          <span>Нова нотатка</span>
        </button>
      </main>
    );
  }

  const words = countWords(note.content);
  const chars = countCharacters(note.content);

  return (
    <main
      id={isDeck ? 'deck-editor-main-pane' : 'editor-main-pane'}
      className="flex-1 min-w-0 min-h-0 h-full flex flex-col bg-white relative overflow-hidden"
    >
      {/* Floating minimal scrollbar in anchor dot style (when note does not have multiple sections) */}
      {sections.length <= 1 && (
        <FloatingScrollbar
          containerRef={documentFrameRef}
          rightOffsetClass={isDeck ? 'right-2' : 'right-1.5 sm:right-3 md:right-5'}
          dotSizeClass="w-1.5 h-1.5"
          topPadding={isDeck ? 20 : 36}
          bottomPadding={isDeck ? 16 : 32}
        />
      )}

      {/* Document Workspace (Scrolls under the seamless translucent floating island header) */}
      <div
        ref={documentFrameRef}
        id={isDeck ? 'deck-editor-document-frame' : 'editor-document-frame'}
        onScroll={handleDocumentScroll}
        className={
          isDeck
            ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-8 py-5 select-text scrollbar-none'
            : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none px-4 sm:px-8 md:px-12 lg:px-16 pt-5 sm:pt-7 md:pt-8 pb-28 sm:pb-32 [mask-image:linear-gradient(to_bottom,transparent_0px,transparent_4px,black_18px,black_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0px,transparent_4px,black_18px,black_100%)]'
        }
      >
        <div className="w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto relative min-w-0">
          {/* Interactive Table Editor Overlay (Word-like resizing, +/- rows/cols, Word copy) */}
          <TableEditorManager
            editorRef={contentRef}
            onContentChange={handleContentInput}
          />

          {/* Note Title Input */}
          <div className="flex items-center gap-2 mb-4 sm:mb-6 min-w-0">
            <input
              ref={titleInputRef}
              id={isDeck ? 'deck-editor-title-input' : 'editor-title-input'}
              type="text"
              value={note.title}
              onChange={handleTitleChange}
              onFocus={() => onTyping?.()}
              onKeyDown={() => onTyping?.()}
              placeholder="Назва нотатки"
              className={
                isDeck
                  ? 'flex-1 min-w-0 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none'
                  : 'flex-1 min-w-0 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none'
              }
            />
          </div>

          {/* Dynamic Section Anchor Indicator on Heading Focus/Click */}
          {activeHeadingInfo && (
            <div
              id="active-heading-anchor-badge"
              style={{ top: `${activeHeadingInfo.top}px` }}
              className="absolute -left-6 sm:-left-8 -translate-y-1/2 flex items-center z-20 transition-all duration-150"
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
            id={isDeck ? 'deck-editor-content-area' : 'editor-content-area'}
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
            className={
              isDeck
                ? 'editor-typography outline-none text-neutral-800 text-sm sm:text-base leading-relaxed min-h-[300px] break-words max-w-full'
                : 'editor-typography outline-none text-neutral-800 text-sm sm:text-base leading-relaxed min-h-[400px] break-words max-w-full'
            }
          />
        </div>
      </div>

      {/* Vertical Anchor Rail Navigator (Dots) */}
      <AnchorVerticalRail
        sections={sections}
        activeSectionId={activeSectionId}
        onNavigateToSection={scrollToSection}
        className={
          isDeck
            ? 'absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 p-1 transition-all select-none pointer-events-auto'
            : undefined
        }
      />
    </main>
  );
});
