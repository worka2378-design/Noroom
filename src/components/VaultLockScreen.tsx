import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Trash2 } from 'lucide-react';
import { VaultMeta, verifyVaultPassword } from '../utils/crypto';
import { LogoIcon } from './LogoIcon';

interface VaultLockScreenProps {
  meta: VaultMeta;
  onUnlock: (password: string) => Promise<boolean>;
  onResetVault: () => void;
}

export const VaultLockScreen: React.FC<VaultLockScreenProps> = ({
  meta,
  onUnlock,
  onResetVault,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const isValid = await verifyVaultPassword(password, meta);
      if (!isValid) {
        setError('Невірний пароль');
        setIsLoading(false);
        return;
      }

      const success = await onUnlock(password);
      if (!success) {
        setError('Помилка розшифрування');
      }
    } catch (err) {
      console.error('Unlock error:', err);
      setError('Не вдалося розшифрувати');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/25 backdrop-blur-md px-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl border border-neutral-200/80 p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-150 text-center">
        {/* Logo without background container */}
        <div className="flex justify-center mb-6">
          <LogoIcon className="w-10 h-10" />
        </div>

        {/* Password input with embedded action arrow */}
        <form onSubmit={handleUnlockSubmit} className="space-y-2">
          <div className="relative flex items-center">
            <input
              id="vault-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              placeholder="Пароль..."
              className="w-full pl-4 pr-16 py-2 bg-neutral-50 border border-neutral-200 rounded-full text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
            <div className="absolute right-1.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                title={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
              </button>

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-neutral-900 hover:bg-black text-white transition-colors disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:cursor-not-allowed cursor-pointer"
                title="Розблокувати (Enter)"
                aria-label="Розблокувати"
              >
                {isLoading ? (
                  <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 pt-0.5 text-center">
              {error}
            </p>
          )}
        </form>

        {/* Trash reset icon (turns red on hover) */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            title="Скинути сейф та очистити зашифровані дані"
            aria-label="Скинути сейф"
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Wipe / Reset Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-neutral-900">
              Скидання сейфу
            </h2>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Пароль не зберігається і його неможливо відновити. Скидання призведе до видалення зашифрованих даних на цьому пристрої.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetVault();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-900 rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-neutral-700" strokeWidth={1.75} />
                Очистити все
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
