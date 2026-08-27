import React, { useRef } from 'react';
import { NoteSection } from '../utils/sections';

interface AnchorVerticalRailProps {
  sections: NoteSection[];
  activeSectionId: string | null;
  onNavigateToSection: (sectionId: string, index: number) => void;
  className?: string;
}

/**
 * Minimal vertical rail for anchor navigation exclusively via dots on the right side
 */
export const AnchorVerticalRail: React.FC<AnchorVerticalRailProps> = ({
  sections,
  activeSectionId,
  onNavigateToSection,
  className,
}) => {
  const railRef = useRef<HTMLDivElement>(null);

  if (sections.length <= 1) return null;

  return (
    <div
      ref={railRef}
      id="anchor-vertical-rail"
      className={
        className ||
        'fixed right-1.5 sm:right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 p-0.5 sm:p-1 transition-all select-none pointer-events-auto'
      }
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
            className="group relative w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center cursor-pointer outline-none transition-transform active:scale-95"
            aria-label={section.title}
          >
            <span
              className={`transition-all duration-200 rounded-full block pointer-events-none w-1.5 h-1.5 ${
                isActive
                  ? 'bg-neutral-900 scale-110 shadow-2xs'
                  : 'bg-neutral-300 group-hover:bg-neutral-600'
              }`}
            />

            {/* Floating Tooltip displaying anchor title */}
            <span className="pointer-events-none absolute right-7 sm:right-8 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center whitespace-nowrap bg-white/90 backdrop-blur-md border border-neutral-200/90 shadow-xs text-neutral-800 text-[11px] font-medium px-2.5 py-1 rounded-full z-50 animate-in fade-in slide-in-from-right-1 duration-150">
              {section.title}
            </span>
          </button>
        );
      })}
    </div>
  );
};
