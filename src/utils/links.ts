export interface ExtractedLink {
  id: string;
  url: string;
  displayTitle: string;
  domain: string;
  faviconUrl: string;
  noteId: string;
  noteTitle: string;
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
 * Parses all links found inside an array of Notes
 */
export function extractAllLinksFromNotes(notes: { id: string; title: string; content: string }[]): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seenSet = new Set<string>();

  notes.forEach((note) => {
    if (!note.content) return;
    
    // 1. Match HTML anchor tags: <a ... href="..." ...>...</a>
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const anchors = tempDiv.querySelectorAll('a');

    anchors.forEach((a, index) => {
      const href = a.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('www.'))) {
        const fullUrl = href.startsWith('www.') ? `https://${href}` : href;
        const textContent = a.textContent?.trim() || '';
        const domain = extractDomain(fullUrl);
        const displayTitle = formatUrlTitle(fullUrl, textContent);
        const linkKey = `${note.id}-${fullUrl}-${index}`;

        if (!seenSet.has(linkKey)) {
          seenSet.add(linkKey);
          links.push({
            id: linkKey,
            url: fullUrl,
            displayTitle,
            domain,
            faviconUrl: getFaviconUrl(domain),
            noteId: note.id,
            noteTitle: note.title.trim() || 'Без назви',
          });
        }
      }
    });

    // 2. Also match raw text URLs that might not yet be wrapped in <a>
    const rawUrlRegex = /(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/gi;
    const plainText = tempDiv.textContent || '';
    let match: RegExpExecArray | null;
    let rawIndex = 0;

    while ((match = rawUrlRegex.exec(plainText)) !== null) {
      let rawUrl = match[0];
      // remove trailing punctuation if accidentally captured
      rawUrl = rawUrl.replace(/[.,;:!?)]+$/, '');
      const fullUrl = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
      const domain = extractDomain(fullUrl);
      const displayTitle = formatUrlTitle(fullUrl);
      const linkKey = `${note.id}-${fullUrl}-raw-${rawIndex++}`;

      // Only add if not already extracted from anchors for this note
      const exists = links.some((l) => l.noteId === note.id && l.url === fullUrl);
      if (!exists && !seenSet.has(linkKey)) {
        seenSet.add(linkKey);
        links.push({
          id: linkKey,
          url: fullUrl,
          displayTitle,
          domain,
          faviconUrl: getFaviconUrl(domain),
          noteId: note.id,
          noteTitle: note.title.trim() || 'Без назви',
        });
      }
    }
  });

  return links;
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
