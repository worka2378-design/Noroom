export interface NoteSection {
  id: string;
  title: string;
  snippet: string;
  fullText: string;
  isExplicitAnchor: boolean;
  type: 'anchor' | 'heading' | 'auto';
}

/**
 * Clean HTML to plain text
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate snippet to readable length
 */
export function makeSnippet(text: string, maxLength = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).trim() + '…';
}

/**
 * Generate a smart section title from a text block
 */
export function generateSectionTitleFromText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Розділ';

  // 1. Check for leading numbered or bullet patterns like "1. Опис", "Розділ 2:", "Тема:"
  const headerPrefixMatch = clean.match(/^(?:(?:[0-9]{1,2}[.)]|Розділ\s*[0-9]+|Тема|Пункт|Частина|Section)\s*[:.-]?\s*)([^.!?\n]{3,40})/i);
  if (headerPrefixMatch && headerPrefixMatch[1]) {
    const candidate = headerPrefixMatch[0].trim();
    return candidate.length > 35 ? candidate.substring(0, 35).trim() + '…' : candidate;
  }

  // 2. Take the first clause/sentence
  const firstClause = clean.split(/[.!?:\n—–]/)[0].trim();
  if (firstClause.length >= 3 && firstClause.length <= 36) {
    return firstClause;
  }

  // 3. Take first 4-5 words
  const words = firstClause.split(/\s+/).slice(0, 5).join(' ');
  if (words.length > 32) {
    return words.substring(0, 32).trim() + '…';
  }
  return words || 'Розділ';
}

/**
 * Build HTML string for a visual anchor block
 */
export function createAnchorElementHtml(anchorId: string, title: string): string {
  return `<div class="note-anchor-block my-5 flex items-center gap-2.5 select-none" data-anchor-id="${anchorId}" id="${anchorId}" contenteditable="false"><div class="h-px bg-neutral-200/80 flex-1"></div><div class="flex items-center gap-1.5 text-xs text-neutral-400 group"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-neutral-400"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg><span class="anchor-label cursor-text text-neutral-600 hover:text-neutral-900 font-medium px-1.5 py-0.5 rounded outline-none focus:bg-neutral-100 focus:text-neutral-950" contenteditable="true" spellcheck="false">${title}</span><button type="button" class="anchor-delete-btn opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-600 transition-opacity p-0.5" title="Видалити якір"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="h-px bg-neutral-200/80 flex-1"></div></div>`;
}

/**
 * Automatically analyzes note HTML and inserts anchor dividers (.note-anchor-block)
 * with meaningful section titles when the note is large or partitioned.
 * Threshold: > 60 words, or >= 2 paragraphs/headings.
 */
export function autoPartitionNoteWithAnchors(
  content: string,
  options: { force?: boolean; minWords?: number } = {}
): { updatedHtml: string; addedCount: number } {
  if (!content || !content.trim()) {
    return { updatedHtml: content, addedCount: 0 };
  }

  const temp = document.createElement('div');
  temp.innerHTML = content;

  // Check if explicit anchors already exist
  const existingAnchors = temp.querySelectorAll('.note-anchor-block');
  if (existingAnchors.length > 0 && !options.force) {
    return { updatedHtml: content, addedCount: 0 };
  }

  const plainText = htmlToPlainText(content);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const minWords = options.minWords ?? 50;

  // If text is too short and not forced, don't partition
  if (wordCount < minWords && !options.force) {
    return { updatedHtml: content, addedCount: 0 };
  }

  let addedCount = 0;

  // 1. If note contains Headings (h1, h2, h3), place anchors before them
  const headings = Array.from(temp.querySelectorAll('h1, h2, h3'));
  if (headings.length >= 1) {
    headings.forEach((heading, idx) => {
      const prevEl = heading.previousElementSibling;
      if (prevEl && prevEl.classList.contains('note-anchor-block')) return;

      const headingText = (heading.textContent || '').trim();
      const title = headingText || `Розділ ${idx + 1}`;
      const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);
      
      const anchorDiv = document.createElement('div');
      anchorDiv.innerHTML = createAnchorElementHtml(anchorId, title);
      const anchorNode = anchorDiv.firstElementChild;
      if (anchorNode) {
        heading.parentNode?.insertBefore(anchorNode, heading);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      return { updatedHtml: temp.innerHTML, addedCount };
    }
  }

  // 2. Otherwise partition by paragraphs / major content blocks
  // Collect direct children or block elements
  const blocks = Array.from(temp.children).filter((el) => {
    if (el.classList.contains('note-anchor-block')) return false;
    const text = (el.textContent || '').trim();
    return text.length > 0;
  });

  if (blocks.length >= 2) {
    // Determine section spacing (every 2-3 paragraphs depending on total length)
    const step = blocks.length <= 4 ? 2 : Math.max(2, Math.floor(blocks.length / 3));

    for (let i = 0; i < blocks.length; i += step) {
      const block = blocks[i] as HTMLElement;
      // If previous sibling is already an anchor, skip
      if (block.previousElementSibling?.classList.contains('note-anchor-block')) {
        continue;
      }

      // Extract section text from this block and next few blocks
      const chunkBlocks = blocks.slice(i, i + step);
      const chunkText = chunkBlocks.map((b) => b.textContent || '').join(' ').trim();
      const title = generateSectionTitleFromText(chunkText);
      const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);

      const anchorDiv = document.createElement('div');
      anchorDiv.innerHTML = createAnchorElementHtml(anchorId, title);
      const anchorNode = anchorDiv.firstElementChild;
      if (anchorNode) {
        block.parentNode?.insertBefore(anchorNode, block);
        addedCount++;
      }
    }
  } else if (blocks.length === 1 && wordCount >= minWords) {
    // Single large block (e.g. big div or p) -> split into paragraphs by <br> or double newlines if possible
    const block = blocks[0] as HTMLElement;
    const title = generateSectionTitleFromText(plainText);
    const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);
    const anchorDiv = document.createElement('div');
    anchorDiv.innerHTML = createAnchorElementHtml(anchorId, title);
    const anchorNode = anchorDiv.firstElementChild;
    if (anchorNode) {
      block.parentNode?.insertBefore(anchorNode, block);
      addedCount++;
    }
  }

  return {
    updatedHtml: addedCount > 0 ? temp.innerHTML : content,
    addedCount,
  };
}

/**
 * Parse HTML content of a note into structured sections/anchors.
 * Handles:
 * 1. Explicit anchors (.note-anchor-block)
 * 2. Headings (h1, h2, h3)
 * 3. Auto-partitioned sections for large notes (> 200 words or > 1000 characters)
 */
export function extractNoteSections(content: string, noteTitle = ''): NoteSection[] {
  if (!content || !content.trim()) return [];

  const temp = document.createElement('div');
  temp.innerHTML = content;

  const sections: NoteSection[] = [];
  
  // Find all explicit anchor blocks
  const anchorElements = Array.from(temp.querySelectorAll('.note-anchor-block'));
  
  // Find all heading elements
  const headingElements = Array.from(temp.querySelectorAll('h1, h2, h3'));

  const totalWords = htmlToPlainText(content).split(/\s+/).filter(Boolean).length;
  const isLargeNote = totalWords >= 150 || content.length > 800;

  // Case 1: If there are explicit anchors or headings
  if (anchorElements.length > 0 || headingElements.length > 0) {
    // Collect all marker nodes in DOM order
    const markers: { node: HTMLElement; type: 'anchor' | 'heading'; id: string; title: string }[] = [];

    temp.querySelectorAll('.note-anchor-block, h1, h2, h3').forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.classList.contains('note-anchor-block')) {
        const id = htmlEl.getAttribute('data-anchor-id') || htmlEl.getAttribute('id') || `anchor-${index}`;
        const labelEl = htmlEl.querySelector('.anchor-label');
        const title = (labelEl?.textContent || '').trim() || 'Якір';
        markers.push({ node: htmlEl, type: 'anchor', id, title });
      } else {
        const tag = htmlEl.tagName.toLowerCase();
        const id = htmlEl.getAttribute('id') || `heading-${tag}-${index}`;
        const title = (htmlEl.textContent || '').trim() || 'Розділ';
        if (title) {
          markers.push({ node: htmlEl, type: 'heading', id, title });
        }
      }
    });

    if (markers.length > 0) {
      // Content before first marker
      const allChildren = Array.from(temp.children);
      const firstMarkerIndex = allChildren.findIndex((child) =>
        markers.some((m) => m.node === child || child.contains(m.node))
      );

      if (firstMarkerIndex > 0) {
        const introNodes = allChildren.slice(0, firstMarkerIndex);
        const introText = introNodes.map((n) => n.textContent || '').join(' ').trim();
        if (introText) {
          sections.push({
            id: 'section-intro',
            title: noteTitle ? `Вступ: ${noteTitle}` : 'Вступ',
            snippet: makeSnippet(introText),
            fullText: introText,
            isExplicitAnchor: false,
            type: 'auto',
          });
        }
      }

      // Collect text between markers
      for (let i = 0; i < markers.length; i++) {
        const currentMarker = markers[i];
        const nextMarker = markers[i + 1];

        // Gather siblings until next marker
        let sectionText = '';
        let curr: Node | null = currentMarker.node.nextSibling;

        while (curr) {
          if (nextMarker && (curr === nextMarker.node || (curr.nodeType === 1 && (curr as HTMLElement).contains(nextMarker.node)))) {
            break;
          }
          sectionText += ' ' + (curr.textContent || '');
          curr = curr.nextSibling;
        }

        const cleanSectionText = sectionText.replace(/\s+/g, ' ').trim();

        sections.push({
          id: currentMarker.id,
          title: currentMarker.title,
          snippet: makeSnippet(cleanSectionText || currentMarker.title),
          fullText: `${currentMarker.title} ${cleanSectionText}`.trim(),
          isExplicitAnchor: currentMarker.type === 'anchor',
          type: currentMarker.type,
        });
      }

      return sections;
    }
  }

  // Case 2: Large note with no explicit markers -> Auto-partition by paragraphs/blocks
  if (isLargeNote) {
    const blocks = Array.from(temp.children).filter((el) => {
      const text = (el.textContent || '').trim();
      return text.length > 10;
    });

    if (blocks.length >= 2) {
      // Group blocks into logical sections (e.g. 2-3 paragraphs each)
      const chunkSize = Math.max(1, Math.ceil(blocks.length / 4));
      
      for (let i = 0; i < blocks.length; i += chunkSize) {
        const chunkBlocks = blocks.slice(i, i + chunkSize);
        const chunkText = chunkBlocks.map((b) => b.textContent || '').join(' ').trim();
        const autoTitle = generateSectionTitleFromText(chunkText);
        const firstBlock = chunkBlocks[0] as HTMLElement;
        const autoId = firstBlock.getAttribute('id') || `auto-section-${i}`;

        sections.push({
          id: autoId,
          title: autoTitle,
          snippet: makeSnippet(chunkText),
          fullText: chunkText,
          isExplicitAnchor: false,
          type: 'auto',
        });
      }

      return sections;
    }
  }

  // Single default section for regular small notes
  const fullText = htmlToPlainText(content);
  return [
    {
      id: 'section-root',
      title: noteTitle || 'Нотатка',
      snippet: makeSnippet(fullText),
      fullText,
      isExplicitAnchor: false,
      type: 'auto',
    },
  ];
}

/**
 * Find matching sections within a note for a given search query
 */
export function findMatchingSectionsInNote(
  noteContent: string,
  noteTitle: string,
  query: string
): NoteSection[] {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  const sections = extractNoteSections(noteContent, noteTitle);

  return sections.filter((section) => {
    const titleMatch = section.title.toLowerCase().includes(q);
    const contentMatch = section.fullText.toLowerCase().includes(q);
    return titleMatch || contentMatch;
  });
}
