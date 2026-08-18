export interface ExtractedLink {
  id: string;
  url: string;
  displayTitle: string;
  domain: string;
  faviconUrl: string;
  noteId: string;
  noteTitle: string;
  heading?: string | null;
}

export function extractDomain(urlStr: string): string {
  try {
    let cleanUrl = urlStr.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const parsed = new URL(cleanUrl);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return urlStr;
  }
}

export function getFaviconUrl(domainOrUrl: string): string {
  const domain = extractDomain(domainOrUrl);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function formatUrlTitle(urlStr: string, customText?: string): string {
  if (customText && customText.trim() && !customText.startsWith('http://') && !customText.startsWith('https://')) {
    return customText.trim();
  }
  try {
    let cleanUrl = urlStr.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const parsed = new URL(cleanUrl);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const pathname = parsed.pathname !== '/' ? parsed.pathname : '';
    if (pathname && pathname.length > 1) {
      // Return e.g. domain + path
      const shortPath = pathname.length > 20 ? pathname.slice(0, 20) + '…' : pathname;
      return `${domain}${shortPath}`;
    }
    return domain;
  } catch {
    return urlStr;
  }
}

/**
 * Parses all links found inside a single Note with heading/section associations
 */
export function extractLinksFromNote(note: { id: string; title: string; content: string }): ExtractedLink[] {
  if (!note.content || !note.content.trim()) return [];

  const temp = document.createElement('div');
  temp.innerHTML = note.content;

  const links: ExtractedLink[] = [];
  const seenUrlsInNote = new Set<string>();
  let currentHeading: string | null = null;
  let linkCounter = 0;

  function isHeadingElement(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return true;
    if (el.classList.contains('note-anchor-block') || el.classList.contains('anchor-block')) return true;
    if ((tag === 'p' || tag === 'div') && el.children.length === 1) {
      const childTag = el.children[0].tagName.toLowerCase();
      if (['b', 'strong', 'u'].includes(childTag) && el.textContent?.trim() && !el.querySelector('a')) {
        return true;
      }
    }
    return false;
  }

  function getHeadingText(el: HTMLElement): string {
    if (el.classList.contains('note-anchor-block')) {
      const labelEl = el.querySelector('.anchor-label');
      return (labelEl?.textContent || el.textContent || '').trim();
    }
    return (el.textContent || '').trim();
  }

  function walk(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (isHeadingElement(el)) {
        const headingText = getHeadingText(el);
        if (headingText) {
          currentHeading = headingText;
        }
        return;
      }

      if (tag === 'a') {
        const href = el.getAttribute('href') || el.getAttribute('data-url');
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('www.'))) {
          const fullUrl = href.startsWith('www.') ? `https://${href}` : href;
          const textContent = el.textContent?.trim() || '';
          const domain = extractDomain(fullUrl);
          const displayTitle = formatUrlTitle(fullUrl, textContent);
          const linkId = `${note.id}-${linkCounter++}-${encodeURIComponent(fullUrl)}`;

          seenUrlsInNote.add(fullUrl);
          links.push({
            id: linkId,
            url: fullUrl,
            displayTitle,
            domain,
            faviconUrl: getFaviconUrl(domain),
            noteId: note.id,
            noteTitle: note.title.trim() || 'Без назви',
            heading: currentHeading,
          });
        }
        return;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const rawUrlRegex = /(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = rawUrlRegex.exec(text)) !== null) {
        let rawUrl = match[0].replace(/[.,;:!?)]+$/, '');
        const fullUrl = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
        if (!seenUrlsInNote.has(fullUrl)) {
          seenUrlsInNote.add(fullUrl);
          const domain = extractDomain(fullUrl);
          const displayTitle = formatUrlTitle(fullUrl);
          const linkId = `${note.id}-${linkCounter++}-${encodeURIComponent(fullUrl)}`;

          links.push({
            id: linkId,
            url: fullUrl,
            displayTitle,
            domain,
            faviconUrl: getFaviconUrl(domain),
            noteId: note.id,
            noteTitle: note.title.trim() || 'Без назви',
            heading: currentHeading,
          });
        }
      }
    }

    node.childNodes.forEach((child) => walk(child));
  }

  walk(temp);
  return links;
}

/**
 * Parses all links found inside an array of Notes
 */
export function extractAllLinksFromNotes(notes: { id: string; title: string; content: string }[]): ExtractedLink[] {
  return notes.flatMap((note) => extractLinksFromNote(note));
}

/**
 * Removes a link from a specific note's HTML content
 */
export function removeLinkFromContent(htmlContent: string, targetUrl: string): string {
  if (!htmlContent) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  const anchors = tempDiv.querySelectorAll('a');
  anchors.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href === targetUrl || href === `https://${targetUrl}` || targetUrl.includes(href)) {
      a.remove();
    }
  });

  // Also remove raw plain text matching targetUrl if present
  let cleanHtml = tempDiv.innerHTML;
  cleanHtml = cleanHtml.split(targetUrl).join('');
  return cleanHtml;
}

/**
 * Generates a graphic link HTML snippet with favicon icon
 */
export function createGraphicLinkHtml(url: string, label?: string): string {
  let fullUrl = url.trim();
  if (!/^https?:\/\//i.test(fullUrl)) {
    fullUrl = 'https://' + fullUrl;
  }
  const domain = extractDomain(fullUrl);
  const favicon = getFaviconUrl(domain);
  const display = label && label.trim() ? label.trim() : formatUrlTitle(fullUrl);

  return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="rich-link" contenteditable="false" data-url="${fullUrl}"><img src="${favicon}" alt="" class="rich-link-icon" onerror="this.style.display='none'" /><span>${display}</span></a>&nbsp;`;
}

/**
 * Automatically converts raw URLs in HTML into rich graphical links
 */
export function autoConvertUrlsToRichLinks(html: string): string {
  if (!html) return '';

  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Enhance existing anchors that don't have rich-link formatting yet
  const anchors = temp.querySelectorAll('a:not(.rich-link)');
  anchors.forEach((a) => {
    const href = a.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('www.'))) {
      const fullUrl = href.startsWith('www.') ? `https://${href}` : href;
      const domain = extractDomain(fullUrl);
      const favicon = getFaviconUrl(domain);
      const text = a.textContent?.trim() || formatUrlTitle(fullUrl);
      
      a.className = 'rich-link';
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('contenteditable', 'false');
      a.setAttribute('data-url', fullUrl);
      a.innerHTML = `<img src="${favicon}" alt="" class="rich-link-icon" onerror="this.style.display='none'" /><span>${text}</span>`;
    }
  });

  return temp.innerHTML;
}
