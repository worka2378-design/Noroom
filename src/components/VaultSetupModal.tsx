import React, { useState, useEffect } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  X,
  Download,
  ChevronDown,
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
  const [activeTab, setActiveTab] = useState<'settings' | 'password' | 'disable'>('settings');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(
    currentMeta?.autoLockMinutes ?? 15
  );

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentMeta?.autoLockMinutes !== undefined) {
      setAutoLockMinutes(currentMeta.autoLockMinutes);
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
    if (onUpdateAutoLockMinutes) {
      onUpdateAutoLockMinutes(minutes);
      setSuccessMsg('Час автоблокування збережено.');
      setTimeout(() => setSuccessMsg(null), 2500);
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
      setError('Введіть поточний пароль для зняття шифрування.');
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
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-900 font-medium text-sm">
            <Lock className="w-4 h-4 text-neutral-800" strokeWidth={1.75} />
            <span>{isConfigured ? 'Захист нотаток' : 'Увімкнути захист'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-800 p-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Clean tabs without background underlays */}
        {isConfigured && (
          <div className="flex items-center gap-4 text-xs font-medium pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Параметри
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('password');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`transition-colors cursor-pointer ${
                activeTab === 'password'
                  ? 'text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Зміна пароля
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('disable');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`transition-colors cursor-pointer ${
                activeTab === 'disable'
                  ? 'text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Вимкнути
            </button>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <p className="text-xs text-rose-600 px-1">
            {error}
          </p>
        )}

        {successMsg && (
          <p className="text-xs text-neutral-900 px-1 font-medium">
            {successMsg}
          </p>
        )}

        {/* Body Content */}
        {!isConfigured ? (
          /* Initial Vault Setup Form */
          <form onSubmit={handleInitialSetup} className="space-y-3">
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

            <div className="relative">
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full appearance-none pl-3.5 pr-9 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 cursor-pointer transition-colors"
              >
                <option value={5}>Автоблокування: 5 хвилин</option>
                <option value={15}>Автоблокування: 15 хвилин</option>
                <option value={30}>Автоблокування: 30 хвилин</option>
                <option value={60}>Автоблокування: 1 година</option>
                <option value={0}>Автоблокування: лише вручну</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-500">
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
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
          /* General Settings (Auto-lock time change without password) */
          <div className="space-y-3.5">
            <div className="relative">
              <select
                value={autoLockMinutes}
                onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                className="w-full appearance-none pl-3.5 pr-9 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 cursor-pointer transition-colors"
              >
                <option value={5}>Автоблокування: 5 хвилин</option>
                <option value={15}>Автоблокування: 15 хвилин</option>
                <option value={30}>Автоблокування: 30 хвилин</option>
                <option value={60}>Автоблокування: 1 година</option>
                <option value={0}>Автоблокування: лише вручну</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-500">
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
            </div>

            {/* Export encrypted backup option without top divider line */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={onExportBackup}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-medium rounded-full transition-colors cursor-pointer border border-neutral-200/80"
              >
                <Download className="w-3.5 h-3.5 text-neutral-600" strokeWidth={1.75} />
                <span>Експорт зашифрованого бекапу (.vault)</span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors cursor-pointer"
              >
                Готово
              </button>
            </div>
          </div>
        ) : activeTab === 'password' ? (
          /* Change Password Form */
          <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
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

            <div className="flex items-center justify-end gap-2 pt-2">
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
        ) : (
          /* Disable Vault Form */
          <form onSubmit={handleDisableSubmit} className="space-y-3">
            <p className="text-xs text-neutral-500 leading-relaxed px-1">
              Вимкнення захисту збереже всі нотатки у звичайному форматі без пароля.
            </p>

            <div>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Поточний пароль для підтвердження"
                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-full outline-none focus:border-neutral-900 focus:bg-white text-neutral-900 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
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
                disabled={isLoading || !oldPassword}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full transition-colors disabled:opacity-40 disabled:hover:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                Вимкнути захист
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
