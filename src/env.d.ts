/// <reference types="vite/client" />

type QuadrantStr = 'Q1' | 'Q2' | 'Q3' | 'Q4';

interface Todo {
  id: string;
  text: string;
  detailsMarkdown?: string;
  completed: boolean; // legacy
  completedDates?: string[]; // new: array of YYYY-MM-DD
  createdAt: string; // ISO string
  completedAt?: string; // ISO string legacy
  imageUrl?: string; // local file url
  quadrant: QuadrantStr;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

interface Window {
  electronAPI: {
    minimize: () => void;
    close: () => void;
    toggleMiniMode: (is: boolean) => void;
    getTodos: () => Promise<Todo[]>;
    saveTodos: (todos: Todo[]) => void;
    getNotes: () => Promise<Record<string, string>>;
    saveNotes: (notes: Record<string, string>) => void;
    saveImage: (filePath: string) => Promise<string | null>;
    saveImageFromBuffer: (buffer: ArrayBuffer, mimeType: string) => Promise<string | null>;
  }
}
