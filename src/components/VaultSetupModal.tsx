import React, { useState, useEffect } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  Download,
  Ban,
} from 'lucide-react';
import { VaultMeta } from '../utils/crypto';

interface VaultSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
  currentMeta: VaultMeta | null;
  onSetupVault: (password: string, autoLockMinutes: number) => Promise<boolean>;
  onChangePassword: (oldPassword: string, newPassword: string, autoLockMinutes?: number) => Promise<boolean>;
  onUpdateAutoLockMinutes?: (autoLockMinutes: number) => void;
  onDisableVault: (currentPassword: string) => Promise<boolean>;
  onExportBackup: () => void;
}

export const VaultSetupModal: React.FC<VaultSetupModalProps> = ({
  isOpen,
  onClose,
  isConfigured,
  currentMeta,
  onSetupVault,
  onChangePassword,
  onUpdateAutoLockMinutes,
  onDisableVault,
  onExportBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'password'>('settings');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(
    currentMeta?.autoLockMinutes === 10 ? 10 : 5
  );
  const [showDisableInput, setShowDisableInput] = useState(false);

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentMeta?.autoLockMinutes !== undefined) {
      setAutoLockMinutes(currentMeta.autoLockMinutes === 10 ? 10 : 5);
    }
  }, [currentMeta?.autoLockMinutes]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('settings');
      setShowDisableInput(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle initial setup
  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword.length < 4) {
      setError('Пароль має містити щонайменше 4 символи.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Паролі не співпадають.');
      return;
    }

    setIsLoading(true);
    try {
      const ok = await onSetupVault(newPassword, autoLockMinutes);
      if (ok) {
        setSuccessMsg('Сейф створено.');
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setError('Помилка шифрування сейфу.');
      }
    } catch (err) {
      console.error(err);
      setError('Не вдалося зберегти зміни.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle auto-lock time change without changing password
  const handleAutoLockChange = (minutes: number) => {
    setAutoLockMinutes(minutes);
    setShowDisableInput(false);
    if (onUpdateAutoLockMinutes) {
      onUpdateAutoLockMinutes(minutes);
      setSuccessMsg('Час автоблокування збережено.');
      setTimeout(() => setSuccessMsg(null), 2000);
    }
  };

  // Handle change password only
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!oldPassword) {
      setError('Введіть поточний пароль.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Новий пароль має містити щонайменше 4 символи.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Паролі не співпадають.');
      return;
    }

    setIsLoading(true);
    try {
      const ok = await onChangePassword(oldPassword, newPassword, autoLockMinutes);
      if (ok) {
        setSuccessMsg('Пароль успішно оновлено.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setError('Невірний поточний пароль.');
      }
    } catch (err) {
      console.error(err);
      setError('Не вдалося змінити пароль.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle disable vault
  const handleDisableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!oldPassword) {
      setError('Введіть поточний пароль для зняття захисту.');
      return;
    }

    setIsLoading(true);
    try {
      const ok = await onDisableVault(oldPassword);
      if (ok) {
        setSuccessMsg('Шифрування вимкнено.');
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setError('Невірний пароль.');
      }
    } catch (err) {
      console.error(err);
      setError('Помилка зняття захисту.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="vault-modal-card"
        className="w-full max-w-xs sm:max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-150 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Centered Lock Icon without text or close button */}
        <div className="flex justify-center pt-1">
          <Lock className="w-5 h-5 text-neutral-800" strokeWidth={1.75} />
        </div>

        {/* Alerts */}
        {error && (
          <p className="text-xs text-rose-600 px-1 text-center">
            {error}
          </p>
        )}

        {successMsg && (
          <p className="text-xs text-neutral-900 px-1 font-medium text-center">
            {successMsg}
          </p>
        )}

        {/* Body Content */}
        {!isConfigured ? (
          /* Initial Vault Setup Form */
          <form onSubmit={handleInitialSetup} className="space-y-3.5 text-left">
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Мастер-пароль"
                className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Підтвердження пароля"
                className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Circular time options for initial setup */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setAutoLockMinutes(5)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                  autoLockMinutes === 5
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                }`}
                title="Автоблокування: 5 хвилин"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => setAutoLockMinutes(10)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                  autoLockMinutes === 10
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                }`}
                title="Автоблокування: 10 хвилин"
              >
                10
              </button>
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
                disabled={isLoading || !newPassword || !confirmPassword}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors disabled:opacity-40 disabled:hover:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                Зашифрувати
              </button>
            </div>
          </form>
        ) : activeTab === 'settings' ? (
          /* General Settings (Auto-lock time change with 3 circles) */
          <div className="space-y-3.5">
            {/* 3 Circular Selection Options: [ 5 ] [ 10 ] [ ⊘ ] */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleAutoLockChange(5)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                  !showDisableInput && autoLockMinutes === 5
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                }`}
                title="Автоблокування: 5 хвилин"
                aria-label="5 хвилин"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleAutoLockChange(10)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                  !showDisableInput && autoLockMinutes === 10
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                }`}
                title="Автоблокування: 10 хвилин"
                aria-label="10 хвилин"
              >
                10
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisableInput(true);
                  setError(null);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                  showDisableInput
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-50 text-neutral-600 border border-neutral-200 hover:text-red-600 hover:bg-red-50/60 hover:border-red-200'
                }`}
                title="Вимкнути блокування"
                aria-label="Вимкнути блокування"
              >
                <Ban className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* If crossed circle is selected: Password confirmation to disable vault */}
            {showDisableInput ? (
              <form onSubmit={handleDisableSubmit} className="space-y-3 pt-1 text-left">
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Пароль для підтвердження"
                    className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisableInput(false);
                      setError(null);
                      setOldPassword('');
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !oldPassword}
                    className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors disabled:opacity-40 disabled:hover:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Вимкнути
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Export encrypted backup icon button under the circles (no text) */}
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={onExportBackup}
                    title="Експорт зашифрованого бекапу (.vault)"
                    aria-label="Експорт зашифрованого бекапу"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>

                {/* Centered Done Button */}
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors cursor-pointer"
                  >
                    Готово
                  </button>
                </div>

                {/* Change Password Link under Done Button */}
                <div className="flex justify-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('password');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                  >
                    Зміна пароля
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Change Password Form */
          <form onSubmit={handleChangePasswordSubmit} className="space-y-3 text-left">
            <div className="relative">
              <input
                type={showOldPass ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Поточний пароль"
                className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новий пароль"
                className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Підтвердження пароля"
                className="w-full px-3.5 py-2 pr-9 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setError(null);
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isLoading || !oldPassword || !newPassword || !confirmPassword}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors disabled:opacity-40 disabled:hover:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                Оновити пароль
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
