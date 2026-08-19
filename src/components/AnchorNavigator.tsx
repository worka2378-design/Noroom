import React, { useRef } from 'react';
import { NoteSection } from '../utils/sections';

interface AnchorVerticalRailProps {
  sections: NoteSection[];
  activeSectionId: string | null;
  onNavigateToSection: (sectionId: string, index: number) => void;
}

/**
 * Minimal vertical rail for anchor navigation exclusively via dots on the right side
 */
export const AnchorVerticalRail: React.FC<AnchorVerticalRailProps> = ({
  sections,
  activeSectionId,
  onNavigateToSection,
}) => {
  const railRef = useRef<HTMLDivElement>(null);

  if (sections.length <= 1) return null;

  return (
    <div
      ref={railRef}
      id="anchor-vertical-rail"
      className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 hidden sm:flex flex-col items-center gap-1.5 p-1 transition-all select-none pointer-events-auto"
    >
      {/* Anchor Navigation Dots */}
      {sections.map((section, idx) => {
        const isActive = activeSectionId === section.id || (!activeSectionId && idx === 0);
        return (
          <button
            key={section.id + idx}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigateToSection(section.id, idx);
            }}
            className="group relative w-6 h-6 flex items-center justify-center cursor-pointer outline-none transition-transform active:scale-95"
            aria-label={section.title}
          >
            <span
              className={`transition-all duration-200 rounded-full block pointer-events-none w-1.5 h-1.5 ${
                isActive
                  ? 'bg-neutral-900 scale-100'
                  : 'bg-neutral-300 group-hover:bg-neutral-600'
              }`}
            />

            {/* Floating Tooltip displaying anchor title */}
            <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center whitespace-nowrap bg-white/85 backdrop-blur-md border border-neutral-200/80 shadow-xs text-neutral-600 text-[11px] font-medium px-2.5 py-1 rounded-full z-50 animate-in fade-in slide-in-from-right-1 duration-150">
              {section.title}
            </span>
          </button>
        );
      })}
    </div>
  );
};
