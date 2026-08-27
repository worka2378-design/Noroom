import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
  X,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AnimatedAiIcon } from './AnimatedIcons';

export const GEMINI_KEY_STORAGE_KEY = 'user_custom_gemini_api_key';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
      setApiKeyInput(stored);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem(GEMINI_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    }
    setIsSaved(true);
    onKeySaved?.(trimmed);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleRemove = () => {
    localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    setApiKeyInput('');
    setIsSaved(false);
    onKeySaved?.('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="api-key-modal-card"
        className="w-full max-w-xs sm:max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-150 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Centered Key Icon */}
        <div className="flex justify-center pt-1">
          <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900 shadow-2xs">
            <KeyRound className="w-5 h-5 text-neutral-900" />
          </div>
        </div>

        <div className="space-y-1 text-center">
          <h3 className="text-sm font-semibold text-neutral-900">
            API Ключ Google Gemini
          </h3>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-[280px] mx-auto">
            Введіть ваш безкоштовний API-ключ Gemini для роботи розумного ШІ-асистента.
          </p>
        </div>

        {isSaved ? (
          <div className="py-4 flex flex-col items-center justify-center space-y-1.5 text-emerald-600">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold">Ключ успішно збережено!</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3.5 text-left">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-neutral-600 px-1">
                Ключ API (AIzaSy...)
              </label>
              <div className="relative">
                <input
                  id="gemini-api-key-input"
                  type={showPassword ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Вставте ваш ключ сюди..."
                  autoFocus
                  className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px]">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 underline underline-offset-2"
              >
                <span>Отримати ключ Google</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>

              {apiKeyInput && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Видалити
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
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
                Зберегти ключ
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
