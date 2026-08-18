export interface Folder {
  id: string;
  name: string;
  type: 'notes' | 'links';
  parentId?: string | null;
  collapsed?: boolean;
  autoCreated?: boolean;
  sourceNoteId?: string;
  sectionHeading?: string;
  interacted?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  pinned: boolean;
  marked: boolean;
  folderId?: string | null;
}

export type TextFormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'removeFormat'
  | 'undo'
  | 'redo';

export type BlockFormatCommand = 'H1' | 'H2' | 'H3' | 'P' | 'BLOCKQUOTE' | 'PRE';
