import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Settings,
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
  Lock as LucideLock,
  Unlock as LucideUnlock,
  Check,
  ChevronRight as LucideChevronRight,
  Pin,
  Bookmark,
  Trash2,
  Copy,
  Plus,
} from 'lucide-react';

/**
 * Animated Sparkles / AI Icon
 * Micro-twinkle animation on hover/idle
 */
export const AnimatedAiIcon: React.FC<{ className?: string; isThinking?: boolean }> = ({
  className = 'w-3.5 h-3.5',
  isThinking = false,
}) => {
  return (
    <motion.span
      className="relative inline-flex items-center justify-center"
      whileHover="hover"
      initial="idle"
      animate={isThinking ? 'thinking' : 'idle'}
    >
      <motion.span
        variants={{
          idle: { scale: 1, rotate: 0 },
          hover: {
            scale: [1, 1.15, 1.05],
            rotate: [0, -10, 10, 0],
            transition: { duration: 0.45, ease: 'easeInOut' },
          },
          thinking: {
            rotate: 360,
            scale: [1, 1.2, 1],
            transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
          },
        }}
      >
        <Sparkles className={className} strokeWidth={1.75} />
      </motion.span>

      {/* Subtle micro twinkle particle */}
      <motion.span
        className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-amber-400 rounded-full pointer-events-none opacity-0"
        variants={{
          idle: { opacity: 0, scale: 0 },
          hover: {
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            y: [-1, -3],
            x: [1, 3],
            transition: { duration: 0.6, repeat: Infinity, repeatDelay: 0.3 },
          },
          thinking: {
            opacity: [0, 0.9, 0],
            scale: [0, 1.2, 0],
            transition: { repeat: Infinity, duration: 0.8 },
          },
        }}
      />
    </motion.span>
  );
};

/**
 * Animated Settings Gear Icon
 * Smooth spring-based rotation on hover
 */
export const AnimatedSettingsIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileHover={{
        rotate: 90,
        transition: { type: 'spring', stiffness: 200, damping: 15 },
      }}
      whileTap={{ scale: 0.9, rotate: 120 }}
    >
      <Settings className={className} strokeWidth={1.75} />
    </motion.span>
  );
};

/**
 * Animated Folder Icon
 * Morphs / transitions smoothly between closed and open states with spring bounce
 */
export const AnimatedFolderIcon: React.FC<{
  isOpen: boolean;
  isSubFolder?: boolean;
  className?: string;
}> = ({ isOpen, isSubFolder = false, className = 'w-3.5 h-3.5' }) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      initial={false}
      animate={{ scale: isOpen ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <motion.span
            key="folder-open"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.15 }}
          >
            <LucideFolderOpen
              className={`${className} ${isSubFolder ? 'text-neutral-700' : 'text-neutral-950'}`}
              strokeWidth={1.75}
            />
          </motion.span>
        ) : (
          <motion.span
            key="folder-closed"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.15 }}
          >
            <LucideFolder
              className={`${className} ${isSubFolder ? 'text-neutral-400' : 'text-neutral-500'}`}
              strokeWidth={1.75}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
};

/**
 * Animated Chevron Arrow for Folder Trees
 * Rotates smoothly from 0 to 90 degrees
 */
export const AnimatedChevron: React.FC<{
  isOpen: boolean;
  className?: string;
}> = ({ isOpen, className = 'w-3.5 h-3.5' }) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      animate={{ rotate: isOpen ? 90 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <LucideChevronRight className={className} strokeWidth={1.75} />
    </motion.span>
  );
};

/**
 * Animated Lock / Unlock Icon
 */
export const AnimatedLockIcon: React.FC<{
  isLocked: boolean;
  className?: string;
}> = ({ isLocked, className = 'w-3.5 h-3.5' }) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLocked ? (
          <motion.span
            key="locked"
            initial={{ opacity: 0, y: -2, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.8 }}
            transition={{ duration: 0.18 }}
          >
            <LucideLock className={`${className} text-neutral-900`} strokeWidth={1.75} />
          </motion.span>
        ) : (
          <motion.span
            key="unlocked"
            initial={{ opacity: 0, y: -2, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.8 }}
            transition={{ duration: 0.18 }}
          >
            <LucideUnlock className={`${className} text-neutral-400`} strokeWidth={1.75} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
};

/**
 * Animated Pin Icon
 */
export const AnimatedPinIcon: React.FC<{
  isPinned: boolean;
  className?: string;
}> = ({ isPinned, className = 'w-3.5 h-3.5' }) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileTap={{ scale: 0.75, rotate: -25 }}
      animate={{
        scale: isPinned ? [1, 1.25, 1] : 1,
        rotate: isPinned ? -15 : 0,
      }}
      transition={{ duration: 0.2 }}
    >
      <Pin
        className={`${className} ${isPinned ? 'fill-neutral-950 text-neutral-950' : ''}`}
        strokeWidth={1.75}
      />
    </motion.span>
  );
};

/**
 * Animated Bookmark / Marker Icon
 */
export const AnimatedBookmarkIcon: React.FC<{
  isMarked: boolean;
  className?: string;
}> = ({ isMarked, className = 'w-3.5 h-3.5' }) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileTap={{ scale: 0.75 }}
      animate={{
        scale: isMarked ? [1, 1.25, 1] : 1,
      }}
      transition={{ duration: 0.2 }}
    >
      <Bookmark
        className={`${className} ${isMarked ? 'fill-neutral-950 text-neutral-950' : ''}`}
        strokeWidth={1.75}
      />
    </motion.span>
  );
};

/**
 * Animated Copy Check Icon
 */
export const AnimatedCopyIcon: React.FC<{
  isCopied: boolean;
  className?: string;
}> = ({ isCopied, className = 'w-3.5 h-3.5' }) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isCopied ? (
        <motion.span
          key="copied"
          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <Check className={`${className} text-emerald-600`} strokeWidth={2} />
        </motion.span>
      ) : (
        <motion.span
          key="copy"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.12 }}
        >
          <Copy className={className} strokeWidth={1.75} />
        </motion.span>
      )}
    </AnimatePresence>
  );
};

/**
 * Animated Trash / Delete Icon
 */
export const AnimatedTrashIcon: React.FC<{
  className?: string;
}> = ({ className = 'w-3.5 h-3.5' }) => {
  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileHover={{
        scale: 1.12,
        rotate: [0, -6, 6, 0],
        transition: { duration: 0.3 },
      }}
      whileTap={{ scale: 0.85 }}
    >
      <Trash2 className={className} strokeWidth={1.75} />
    </motion.span>
  );
};
