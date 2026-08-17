import React, { useState, useEffect } from 'react';
import { Link2, X } from 'lucide-react';

interface LinkModalProps {
  isOpen: boolean;
  initialUrl?: string;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  initialUrl = '',
  onClose,
  onSubmit,
}) => {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl || 'https://');
    }
  }, [isOpen, initialUrl]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="link-modal-card"
        className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-neutral-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-800 font-medium text-sm">
            <Link2 className="w-4 h-4 text-neutral-700" strokeWidth={1.75} />
            <span>Додати посилання</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors"
            >
              Застосувати
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
