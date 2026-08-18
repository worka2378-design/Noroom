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
 * Build HTML string for a visual anchor badge - unused now since anchor icons with names
 * live between the layers panel and editor block.
 */
export function createAnchorElementHtml(anchorId: string, title: string): string {
  return `<span class="note-anchor-marker" data-anchor-id="${anchorId}" id="${anchorId}" data-anchor-title="${title}"></span>`;
}

/**
 * Strips embedded anchor icons, badges, and horizontal dividers from text content
 * so the editor document contains only clean text, while preserving IDs for navigation.
 */
export function cleanLegacyAnchorDividers(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove divider lines
  temp.querySelectorAll('div.h-px, hr.anchor-divider').forEach((el) => el.remove());

  // Remove all embedded .note-anchor-block icons and labels from text flow
  temp.querySelectorAll('.note-anchor-block').forEach((anchorEl) => {
    const anchorId = anchorEl.getAttribute('data-anchor-id') || anchorEl.getAttribute('id');
    const label = anchorEl.querySelector('.anchor-label')?.textContent?.trim();
    const parent = anchorEl.parentElement;
    
    if (parent) {
      if (anchorId && !parent.getAttribute('data-anchor-id') && !parent.getAttribute('id')) {
        parent.setAttribute('data-anchor-id', anchorId);
        if (label) parent.setAttribute('data-anchor-title', label);
      }
    }
    anchorEl.remove();
  });

  return temp.innerHTML;
}

/**
 * Automatically assigns section IDs to headings and major paragraphs for anchor navigation
 * without cluttering the text with inline graphic icons.
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

  let addedCount = 0;

  // 1. Tag headings with anchor IDs
  const headings = Array.from(temp.querySelectorAll('h1, h2, h3'));
  headings.forEach((heading, idx) => {
    if (!heading.id && !heading.getAttribute('data-anchor-id')) {
      const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);
      heading.id = anchorId;
      heading.setAttribute('data-anchor-id', anchorId);
      addedCount++;
    }
  });

  // 2. Partition by paragraphs if longer
  const blocks = Array.from(temp.children).filter((el) => {
    const text = (el.textContent || '').trim();
    return text.length > 0;
  });

  if (blocks.length >= 3) {
    const step = blocks.length <= 4 ? 2 : Math.max(2, Math.floor(blocks.length / 3));
    for (let i = step; i < blocks.length; i += step) {
      const block = blocks[i] as HTMLElement;
      if (!block.id && !block.getAttribute('data-anchor-id')) {
        const anchorId = 'anchor-' + Math.random().toString(36).substring(2, 9);
        block.id = anchorId;
        block.setAttribute('data-anchor-id', anchorId);
        addedCount++;
      }
    }
  }

  return {
    updatedHtml: addedCount > 0 ? temp.innerHTML : content,
    addedCount,
  };
}

/**
 * Parse HTML content of a note into structured sections/anchors.
 * Only extracts explicit note title, headings (h1..h6), and explicit anchors.
 */
export function extractNoteSections(content: string, noteTitle = ''): NoteSection[] {
  const sections: NoteSection[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  const cleanNoteTitle = (noteTitle || 'Початок нотатки').trim();
  const normalizedNoteTitle = cleanNoteTitle.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

  // 1. Root / Top of the note
  const fullText = htmlToPlainText(content);
  sections.push({
    id: 'section-root',
    title: cleanNoteTitle,
    snippet: makeSnippet(fullText),
    fullText,
    isExplicitAnchor: true,
    type: 'anchor',
  });
  seenIds.add('section-root');
  if (normalizedNoteTitle) {
    seenTitles.add(normalizedNoteTitle);
  }

  if (!content || !content.trim()) return sections;

  const temp = document.createElement('div');
  temp.innerHTML = content;

  // Single unified in-order traversal of headings and explicit anchor markers
  const candidateElements = Array.from(
    temp.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-anchor-id], [data-anchor-title], .note-anchor-marker')
  ) as HTMLElement[];

  let headingIdx = 0;

  for (const el of candidateElements) {
    // Avoid processing elements nested inside another candidate element
    if (candidateElements.some((parent) => parent !== el && parent.contains(el))) {
      continue;
    }

    const isHeading = /^H[1-6]$/i.test(el.tagName);
    const customTitle = el.getAttribute('data-anchor-title');
    const rawText = (el.textContent || '').trim();
    const title = (customTitle || (isHeading ? rawText : generateSectionTitleFromText(rawText))).trim();

    if (!title) continue;

    const normalizedTitle = title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    // If duplicate title of an already added section or note title, skip
    if (!normalizedTitle || seenTitles.has(normalizedTitle)) {
      continue;
    }

    let anchorId = el.getAttribute('data-anchor-id') || el.id;
    if (!anchorId) {
      anchorId = isHeading ? `heading-${headingIdx++}` : `anchor-${Math.random().toString(36).substring(2, 9)}`;
    }

    if (seenIds.has(anchorId)) {
      anchorId = `${anchorId}-${Math.random().toString(36).substring(2, 6)}`;
    }

    seenIds.add(anchorId);
    seenTitles.add(normalizedTitle);

    sections.push({
      id: anchorId,
      title,
      snippet: makeSnippet(rawText || title),
      fullText: rawText || title,
      isExplicitAnchor: !isHeading || Boolean(el.getAttribute('data-anchor-id')),
      type: isHeading ? 'heading' : 'anchor',
    });
  }

  return sections;
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
