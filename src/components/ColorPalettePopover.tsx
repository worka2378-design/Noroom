import React, { useState, useRef } from 'react';
import { Check, RotateCcw, Pipette, EyeOff } from 'lucide-react';

export const TEXT_COLORS: string[] = [
  '#171717', '#404040', '#737373', '#a3a3a3', '#d4d4d4', '#ffffff',
  '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488', '#2563eb',
  '#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#78350f', '#0891b2',
];

export const HIGHLIGHT_COLORS: string[] = [
  '#fef08a', '#fde047', '#fed7aa', '#fda4af', '#fecdd3', '#e9d5ff',
  '#d8b4fe', '#bae6fd', '#7dd3fc', '#a5f3fc', '#bbf7d0', '#86efac',
  '#d9f99d', '#fef3c7', '#c7d2fe', '#fbcfe8', '#99f6e4', '#e5e7eb',
];

interface TextColorPaletteProps {
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

export const TextColorPalette: React.FC<TextColorPaletteProps> = ({
  currentColor,
  onSelectColor,
  onClose,
}) => {
  const [customHex, setCustomHex] = useState(currentColor || '#171717');
  const normalize = (c: string) => c.toLowerCase().trim();

  const handleCustomChange = (val: string) => {
    setCustomHex(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      onSelectColor(val);
    }
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-2.5 w-[204px] flex flex-col gap-2 text-xs text-neutral-800 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Action Header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium text-neutral-500">Колір тексту</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onSelectColor('#171717');
            onClose();
          }}
          className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-900 px-2 py-0.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
          title="Скинути до стандартного"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Скинути</span>
        </button>
      </div>

      {/* Circular Color Swatches Grid */}
      <div className="grid grid-cols-6 gap-1.5 p-0.5">
        {TEXT_COLORS.map((color) => {
          const isSelected = normalize(currentColor) === normalize(color);
          const isLight = color === '#ffffff' || color === '#d4d4d4';
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectColor(color);
                onClose();
              }}
              className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isLight ? 'border border-neutral-200' : ''
              } ${
                isSelected
                  ? 'ring-2 ring-neutral-900 ring-offset-1 ring-offset-white scale-110'
                  : 'hover:scale-115 hover:shadow-xs'
              }`}
              style={{ backgroundColor: color }}
            >
              {isSelected && (
                <Check
                  className={`w-3 h-3 stroke-[2.5] ${
                    isLight ? 'text-neutral-900' : 'text-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Pipette & Custom Hex Row */}
      <div className="pt-1.5 border-t border-neutral-100 flex items-center gap-1.5 px-0.5">
        <label
          className="relative w-5 h-5 rounded-full cursor-pointer shrink-0 border border-neutral-300 overflow-hidden flex items-center justify-center group shadow-xs"
          style={{ backgroundColor: customHex }}
          title="Піпетка"
        >
          <Pipette className="w-2.5 h-2.5 text-neutral-900 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          <input
            type="color"
            value={customHex.startsWith('#') && customHex.length === 7 ? customHex : '#171717'}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        <input
          type="text"
          value={customHex}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="#171717"
          maxLength={7}
          className="w-full bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-neutral-900 rounded-full px-2 py-0.5 text-[10px] font-mono text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
        />
      </div>
    </div>
  );
};

interface HighlightColorPaletteProps {
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

export const HighlightColorPalette: React.FC<HighlightColorPaletteProps> = ({
  currentColor,
  onSelectColor,
  onClose,
}) => {
  const [customHex, setCustomHex] = useState(currentColor || '#fef08a');
  const normalize = (c: string) => c.toLowerCase().trim();

  const handleCustomChange = (val: string) => {
    setCustomHex(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      onSelectColor(val);
    }
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-2.5 w-[204px] flex flex-col gap-2 text-xs text-neutral-800 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Action Header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium text-neutral-500">Маркер</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onSelectColor('transparent');
            onClose();
          }}
          className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-red-600 px-2 py-0.5 rounded-full hover:bg-red-50/60 transition-colors cursor-pointer"
          title="Прибрати виділення"
        >
          <EyeOff className="w-2.5 h-2.5" />
          <span>Прибрати</span>
        </button>
      </div>

      {/* Circular Highlight Swatches Grid */}
      <div className="grid grid-cols-6 gap-1.5 p-0.5">
        {HIGHLIGHT_COLORS.map((color) => {
          const isSelected = normalize(currentColor) === normalize(color);
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectColor(color);
                onClose();
              }}
              className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? 'ring-2 ring-neutral-900 ring-offset-1 ring-offset-white scale-110'
                  : 'hover:scale-115 hover:shadow-xs'
              }`}
              style={{ backgroundColor: color }}
            >
              {isSelected && (
                <Check className="w-3 h-3 stroke-[2.5] text-neutral-900" />
              )}
            </button>
          );
        })}
      </div>

      {/* Pipette & Custom Hex Row */}
      <div className="pt-1.5 border-t border-neutral-100 flex items-center gap-1.5 px-0.5">
        <label
          className="relative w-5 h-5 rounded-full cursor-pointer shrink-0 border border-neutral-300 overflow-hidden flex items-center justify-center group shadow-xs"
          style={{ backgroundColor: customHex }}
          title="Свій колір"
        >
          <Pipette className="w-2.5 h-2.5 text-neutral-900 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          <input
            type="color"
            value={customHex.startsWith('#') && customHex.length === 7 ? customHex : '#fef08a'}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        <input
          type="text"
          value={customHex}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="#fef08a"
          maxLength={7}
          className="w-full bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-neutral-900 rounded-full px-2 py-0.5 text-[10px] font-mono text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
        />
      </div>
    </div>
  );
};

interface NoteMarkerColorPaletteProps {
  currentColor?: string | null;
  onSelectColor: (color: string | null) => void;
  onClose: () => void;
}

export const NoteMarkerColorPalette: React.FC<NoteMarkerColorPaletteProps> = ({
  currentColor,
  onSelectColor,
  onClose,
}) => {
  const [customHex, setCustomHex] = useState(currentColor || '#171717');
  const normalize = (c?: string | null) => (c ? c.toLowerCase().trim() : '');

  const handleCustomChange = (val: string) => {
    setCustomHex(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      onSelectColor(val);
    }
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-full mt-1.5 right-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-2.5 w-[204px] flex flex-col gap-2 text-xs text-neutral-800 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Action Header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium text-neutral-500">Маркер нотатки</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onSelectColor(null);
            onClose();
          }}
          className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-red-600 px-2 py-0.5 rounded-full hover:bg-red-50/60 transition-colors cursor-pointer"
          title="Зняти маркер"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Скинути</span>
        </button>
      </div>

      {/* Circular Color Swatches Grid (Same Palette as Text Color) */}
      <div className="grid grid-cols-6 gap-1.5 p-0.5">
        {TEXT_COLORS.map((color) => {
          const isSelected = normalize(currentColor) === normalize(color);
          const isLight = color === '#ffffff' || color === '#d4d4d4';
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectColor(color);
                onClose();
              }}
              className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isLight ? 'border border-neutral-200' : ''
              } ${
                isSelected
                  ? 'ring-2 ring-neutral-900 ring-offset-1 ring-offset-white scale-110'
                  : 'hover:scale-115 hover:shadow-xs'
              }`}
              style={{ backgroundColor: color }}
            >
              {isSelected && (
                <Check
                  className={`w-3 h-3 stroke-[2.5] ${
                    isLight ? 'text-neutral-900' : 'text-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Pipette & Custom Hex Row */}
      <div className="pt-1.5 border-t border-neutral-100 flex items-center gap-1.5 px-0.5">
        <label
          className="relative w-5 h-5 rounded-full cursor-pointer shrink-0 border border-neutral-300 overflow-hidden flex items-center justify-center group shadow-xs"
          style={{ backgroundColor: customHex }}
          title="Піпетка"
        >
          <Pipette className="w-2.5 h-2.5 text-neutral-900 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          <input
            type="color"
            value={customHex.startsWith('#') && customHex.length === 7 ? customHex : '#171717'}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        <input
          type="text"
          value={customHex}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="#171717"
          maxLength={7}
          className="w-full bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-neutral-900 rounded-full px-2 py-0.5 text-[10px] font-mono text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors"
        />
      </div>
    </div>
  );
};
