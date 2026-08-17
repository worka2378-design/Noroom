import React, { useRef, useEffect } from 'react';
import { FileText, Plus, Sparkles } from 'lucide-react';
import { Note, TextFormatCommand, BlockFormatCommand } from '../types';
import { EditorToolbar } from './EditorToolbar';
import { TableEditorManager } from './TableEditorManager';
import { formatNoteDate, countWords, countCharacters } from '../utils/storage';
import { createGraphicLinkHtml, autoConvertUrlsToRichLinks } from '../utils/links';
import { autoPartitionNoteWithAnchors } from '../utils/sections';

interface EditorPaneProps {
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
}

export const EditorPane: React.FC<EditorPaneProps> = ({
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
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync content when active note changes
  useEffect(() => {
    if (contentRef.current && note) {
      const currentHtml = contentRef.current.innerHTML;
      const noteHtml = note.content || '';
      if (currentHtml !== noteHtml) {
        contentRef.current.innerHTML = autoConvertUrlsToRichLinks(noteHtml);
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
        targetEl.classList.add('transition-all', 'duration-300', 'bg-neutral-100/90', 'rounded-md', 'ring-2', 'ring-neutral-400/40');
        setTimeout(() => {
          targetEl?.classList.remove('bg-neutral-100/90', 'ring-2', 'ring-neutral-400/40');
        }, 1800);
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

      const range = selection.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());

      const tables = container.querySelectorAll('table');
      const cells = container.querySelectorAll('td, th');

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

        if (e.clipboardData) {
          e.preventDefault();
          e.clipboardData.setData('text/html', container.innerHTML);
          e.clipboardData.setData('text/plain', selection.toString());
        }
      }
    };

    editor.addEventListener('copy', handleCopy);
    return () => {
      editor.removeEventListener('copy', handleCopy);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateNote({ title: e.target.value });
  };

  const handleContentInput = () => {
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
    if (sel && sel.rangeCount > 0) {
      const selectedText = sel.toString().trim();
      if (selectedText && selectedText.length <= 40) {
        initialLabel = selectedText;
      }
    }

    const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);
    const anchorBlock = document.createElement('div');
    anchorBlock.className = 'note-anchor-block my-5 flex items-center gap-2.5 select-none';
    anchorBlock.setAttribute('data-anchor-id', anchorId);
    anchorBlock.setAttribute('id', anchorId);
    anchorBlock.setAttribute('contenteditable', 'false');
    anchorBlock.innerHTML = `
      <div class="h-px bg-neutral-200/80 flex-1"></div>
      <div class="flex items-center gap-1.5 text-xs text-neutral-400 group">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-neutral-400"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
        <span class="anchor-label cursor-text text-neutral-600 hover:text-neutral-900 font-medium px-1.5 py-0.5 rounded outline-none focus:bg-neutral-100 focus:text-neutral-950" contenteditable="true" spellcheck="false">${initialLabel}</span>
        <button type="button" class="anchor-delete-btn opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-600 transition-opacity p-0.5" title="Видалити якір">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="h-px bg-neutral-200/80 flex-1"></div>
    `;

    const trailingP = document.createElement('p');
    trailingP.innerHTML = '<br>';

    editor.focus();

    let inserted = false;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(trailingP);
        range.insertNode(anchorBlock);
        inserted = true;
      }
    }

    if (!inserted) {
      editor.appendChild(anchorBlock);
      editor.appendChild(trailingP);
    }

    onUpdateNote({ content: editor.innerHTML });

    // Focus into anchor title so user can rename it immediately
    setTimeout(() => {
      const label = anchorBlock.querySelector('.anchor-label') as HTMLElement | null;
      if (label) {
        label.focus();
        const newSel = window.getSelection();
        if (newSel) {
          const newRange = document.createRange();
          newRange.selectNodeContents(label);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      }
    }, 20);
  };

  const handleAutoPartitionAnchors = (force = true) => {
    const editor = contentRef.current;
    if (!editor) return;

    const currentHtml = editor.innerHTML;
    const { updatedHtml, addedCount } = autoPartitionNoteWithAnchors(currentHtml, {
      force,
      minWords: 30,
    });

    if (addedCount > 0) {
      editor.innerHTML = updatedHtml;
      onUpdateNote({ content: updatedHtml });
    }
  };

  const handleContentBlur = () => {
    const editor = contentRef.current;
    if (!editor) return;

    // When leaving editor, if note is large and has no anchors, auto-generate them
    const currentHtml = editor.innerHTML;
    const { updatedHtml, addedCount } = autoPartitionNoteWithAnchors(currentHtml, {
      force: false,
      minWords: 40,
    });

    if (addedCount > 0) {
      editor.innerHTML = updatedHtml;
      onUpdateNote({ content: updatedHtml });
    }
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

    // If pasting multi-paragraph / substantial text (> 40 words or 2+ paragraphs)
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 40) {
      e.preventDefault();
      const pastedHtml = e.clipboardData.getData('text/html');
      let htmlToInsert = '';
      if (pastedHtml) {
        htmlToInsert = pastedHtml;
      } else {
        htmlToInsert = text
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
      }

      // Automatically partition with section anchors
      const { updatedHtml } = autoPartitionNoteWithAnchors(htmlToInsert, { force: true, minWords: 30 });
      document.execCommand('insertHTML', false, updatedHtml);
      handleContentInput();
      return;
    }
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Handle anchor delete button click
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

  const handleExecCommand = (command: TextFormatCommand, value: string = '') => {
    if (contentRef.current) {
      contentRef.current.focus();
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

  if (!note) {
    return (
      <main id="editor-empty-state" className="flex-1 flex flex-col items-center justify-center p-8 bg-white text-neutral-400 select-none">
        <FileText className="w-12 h-12 text-neutral-200 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-neutral-500 mb-4">
          Оберіть нотатку зі списку або створіть нову
        </p>
        <button
          type="button"
          onClick={onCreateNote}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-xs transition-colors"
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
      {/* Fixed / Top Formatting Toolbar */}
      <EditorToolbar
        isSidebarCollapsed={isSidebarCollapsed}
        onExecCommand={handleExecCommand}
        onFormatBlock={handleFormatBlock}
        onApplyFontFamily={handleApplyFontFamily}
        onApplyFontSize={handleApplyFontSize}
        onOpenLinkModal={onOpenLinkModal}
        onInsertImageFile={handleInsertImageFile}
        onInsertAnchor={handleInsertAnchor}
        onAutoPartitionAnchors={() => handleAutoPartitionAnchors(true)}
        onInsertTable={handleInsertTable}
        onExport={handleExport}
        textColor={textColor}
        onChangeTextColor={(color) => {
          onChangeTextColor(color);
          if (contentRef.current) {
            contentRef.current.focus();
            document.execCommand('foreColor', false, color);
            handleContentInput();
          }
        }}
        highlightColor={highlightColor}
        onChangeHighlightColor={(color) => {
          onChangeHighlightColor(color);
          if (contentRef.current) {
            contentRef.current.focus();
            document.execCommand('hiliteColor', false, color);
            handleContentInput();
          }
        }}
      />

      {/* Document Workspace */}
      <div id="editor-document-frame" className="flex-1 overflow-y-auto px-6 sm:px-12 md:px-16 pt-8 sm:pt-12 pb-24">
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
              placeholder="Назва нотатки"
              className="flex-1 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none"
            />
          </div>

          {/* Smart Auto-Anchor Suggestion Banner if note is large and has no anchors */}
          {words >= 40 && !note.content.includes('note-anchor-block') && (
            <div className="mb-4 flex items-center justify-between gap-2 px-3 py-2 bg-neutral-50/90 border border-neutral-200/70 rounded-lg text-xs text-neutral-600">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-neutral-500 shrink-0" strokeWidth={1.75} />
                <span className="truncate">Нотатка містить декілька блоків. Розставити автоматичні якорі для розділів?</span>
              </div>
              <button
                type="button"
                onClick={() => handleAutoPartitionAnchors(true)}
                className="px-2.5 py-1 text-xs font-medium text-neutral-900 bg-white border border-neutral-200 hover:bg-neutral-100 rounded shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                Розставити якорі
              </button>
            </div>
          )}

          {/* Note Rich Content Editable */}
          <div
            ref={contentRef}
            id="editor-content-area"
            contentEditable
            suppressContentEditableWarning
            onInput={handleContentInput}
            onBlur={handleContentBlur}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onClick={handleContentClick}
            data-placeholder="Почніть писати…"
            className="editor-typography outline-none text-neutral-800 text-base leading-relaxed min-h-[400px]"
          />
        </div>
      </div>

      {/* Floating Status Bar */}
      <footer id="editor-status-bar" className="fixed bottom-4 right-6 text-[11px] text-neutral-400 font-medium flex items-center gap-2 pointer-events-none select-none bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-full">
        <span>{words} слів</span>
        <span>·</span>
        <span>{chars} симв.</span>
        <span>·</span>
        <span>збережено {formatNoteDate(note.updated)}</span>
      </footer>
    </main>
  );
};
