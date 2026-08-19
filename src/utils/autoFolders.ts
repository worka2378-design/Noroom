import { Note, Folder } from '../types';
import { extractLinksFromNote, ExtractedLink } from './links';

/**
 * Normalizes text to a safe slug for deterministic ID generation
 */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

/**
 * Synchronizes auto-generated folders and sub-folders based on note content:
 * - If a note has > 1 link: an auto folder is created for the note.
 * - If the note has headings and under each heading there are links: a sub-folder is created for each heading.
 * - Manual folders and non-auto folder configurations are preserved.
 */
export function syncAutoFolders(
  notes: Note[],
  existingFolders: Folder[],
  linkFolderMap: Record<string, string>
): {
  updatedFolders: Folder[];
  updatedLinkFolderMap: Record<string, string>;
  hasChanges: boolean;
} {
  const activeNoteIds = new Set(notes.map((n) => n.id));

  // Separate user manual folders from auto-managed folders, filtering out any orphaned note-tied folders
  const manualFolders = existingFolders.filter(
    (f) => !f.autoCreated && (!f.sourceNoteId || activeNoteIds.has(f.sourceNoteId))
  );
  const existingAutoFolderMap = new Map<string, Folder>();
  existingFolders
    .filter((f) => f.autoCreated && (!f.sourceNoteId || activeNoteIds.has(f.sourceNoteId)))
    .forEach((f) => existingAutoFolderMap.set(f.id, f));

  const newAutoFolders: Folder[] = [];
  const newLinkFolderMap: Record<string, string> = { ...linkFolderMap };

  // Track all auto folder IDs created in this run
  const activeAutoFolderIds = new Set<string>();
  const allCurrentLinks = notes.flatMap((note) => extractLinksFromNote(note));
  const activeLinkIdSet = new Set(allCurrentLinks.map((l) => l.id));

  notes.forEach((note) => {
    const links = extractLinksFromNote(note);
    const noteTitle = note.title.trim() || 'Без назви';

    // Condition 1: More than 1 link in the note (> 1 link)
    if (links.length > 1) {
      const mainFolderId = `auto-f-${note.id}`;
      const prevMain = existingAutoFolderMap.get(mainFolderId);

      const mainFolder: Folder = {
        id: mainFolderId,
        name: prevMain?.interacted && prevMain?.name ? prevMain.name : noteTitle,
        type: 'links',
        parentId: null,
        collapsed: prevMain?.collapsed ?? false,
        autoCreated: true,
        sourceNoteId: note.id,
        interacted: prevMain?.interacted ?? false,
      };

      newAutoFolders.push(mainFolder);
      activeAutoFolderIds.add(mainFolderId);

      // Distinct headings that have links under them
      const headingNames = Array.from(
        new Set(
          links
            .map((l) => l.heading?.trim())
            .filter((h): h is string => Boolean(h && h.length > 0))
        )
      );

      // Condition 2: Note has headings with links -> create sub-folders
      if (headingNames.length > 0) {
        headingNames.forEach((hName, idx) => {
          const headingSlug = slugify(hName) || `h-${idx}`;
          const subFolderId = `auto-sf-${note.id}-${headingSlug}`;
          const prevSub = existingAutoFolderMap.get(subFolderId);

          const subFolder: Folder = {
            id: subFolderId,
            name: prevSub?.interacted && prevSub?.name ? prevSub.name : hName,
            type: 'links',
            parentId: mainFolderId,
            collapsed: prevSub?.collapsed ?? false,
            autoCreated: true,
            sourceNoteId: note.id,
            sectionHeading: hName,
            interacted: prevSub?.interacted ?? false,
          };

          newAutoFolders.push(subFolder);
          activeAutoFolderIds.add(subFolderId);
        });

        // Map EVERY link in the note to its respective sub-folder or main folder
        links.forEach((link) => {
          const hName = link.heading?.trim();
          if (hName && hName.length > 0) {
            const headingSlug = slugify(hName) || 'h-0';
            const subFolderId = `auto-sf-${note.id}-${headingSlug}`;
            newLinkFolderMap[link.id] = subFolderId;
          } else {
            // Links before any heading go directly into the main note folder
            newLinkFolderMap[link.id] = mainFolderId;
          }
        });
      } else {
        // No headings: all links in this note go directly into the main note folder
        links.forEach((link) => {
          newLinkFolderMap[link.id] = mainFolderId;
        });
      }
    }
  });

  // Clean up linkFolderMap: remove links that no longer exist or belong to auto-folders that were removed
  Object.keys(newLinkFolderMap).forEach((linkId) => {
    if (!activeLinkIdSet.has(linkId)) {
      delete newLinkFolderMap[linkId];
      return;
    }
    const assignedFolderId = newLinkFolderMap[linkId];
    if (
      assignedFolderId.startsWith('auto-') &&
      !activeAutoFolderIds.has(assignedFolderId)
    ) {
      delete newLinkFolderMap[linkId];
    }
  });

  const updatedFolders = [...manualFolders, ...newAutoFolders];

  // Compare to detect if anything changed
  const foldersChanged =
    JSON.stringify(updatedFolders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))) !==
    JSON.stringify(existingFolders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })));

  const mapChanged = JSON.stringify(newLinkFolderMap) !== JSON.stringify(linkFolderMap);

  return {
    updatedFolders,
    updatedLinkFolderMap: newLinkFolderMap,
    hasChanges: foldersChanged || mapChanged,
  };
}
