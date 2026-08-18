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
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-900 font-medium text-sm">
            <Link2 className="w-4 h-4 text-neutral-800" strokeWidth={1.75} />
            <span>Додати посилання</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-800 p-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <input
              type="text"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors cursor-pointer"
            >
              Застосувати
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
