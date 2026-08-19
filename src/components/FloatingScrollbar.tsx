import React, { useEffect, useState, useRef, useCallback } from 'react';

interface FloatingScrollbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
  rightOffsetClass?: string;
  dotSizeClass?: string;
  dotColorClass?: string;
  topPadding?: number;
  bottomPadding?: number;
  autoHideDelay?: number;
  showTooltip?: boolean;
}

export const FloatingScrollbar: React.FC<FloatingScrollbarProps> = ({
  containerRef,
  className = '',
  rightOffsetClass = 'right-2 sm:right-5',
  dotSizeClass = 'w-1.5 h-1.5',
  dotColorClass = 'bg-neutral-300 group-hover:bg-neutral-600 group-active:bg-neutral-800',
  topPadding = 64,
  bottomPadding = 24,
  autoHideDelay = 1200,
  showTooltip = true,
}) => {
  const [state, setState] = useState<{
    visible: boolean;
    top: number;
    percent: number;
    canScroll: boolean;
  }>({
    visible: false,
    top: topPadding,
    percent: 0,
    canScroll: false,
  });

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScroll = scrollHeight > clientHeight + 8;

    if (!canScroll) {
      setState((prev) => ({ ...prev, canScroll: false, visible: false }));
      return;
    }

    const usableHeight = Math.max(10, clientHeight - topPadding - bottomPadding);
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
    const computedTop = topPadding + progress * usableHeight;
    const percent = Math.round(progress * 100);

    // Fade out cleanly if scrolled all the way to the top so it never hovers near toolbar
    const isAtTop = scrollTop < 12;

    setState({
      visible: !isAtTop || isDraggingRef.current,
      top: computedTop,
      percent,
      canScroll: true,
    });

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    if (!isDraggingRef.current) {
      hideTimerRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, visible: false }));
      }, autoHideDelay);
    }
  }, [containerRef, topPadding, bottomPadding, autoHideDelay]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      updatePosition();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updatePosition);

    updatePosition();
    const t = setTimeout(updatePosition, 250);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updatePosition);
      clearTimeout(t);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [containerRef, updatePosition]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const el = containerRef.current;
    if (!el) return;

    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = el.scrollTop;

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setState((prev) => ({ ...prev, visible: true }));

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !el) return;

      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const { scrollHeight, clientHeight } = el;
      const usableHeight = Math.max(10, clientHeight - topPadding - bottomPadding);
      const maxScroll = scrollHeight - clientHeight;

      if (usableHeight > 0) {
        const scrollDelta = (deltaY / usableHeight) * maxScroll;
        el.scrollTop = dragStartScrollTopRef.current + scrollDelta;
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, visible: false }));
      }, autoHideDelay);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!state.canScroll) return null;

  return (
    <div
      className={`absolute top-0 bottom-0 pointer-events-none z-20 select-none ${rightOffsetClass} ${className}`}
      aria-hidden="true"
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          transform: `translateY(${state.top}px)`,
        }}
        className={`group pointer-events-auto cursor-pointer absolute flex items-center justify-center p-1 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ${
          state.visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Anchor-styled Circular Dot (Exact same size as anchor dots) */}
        <span
          className={`rounded-full shadow-2xs transition-all duration-150 group-hover:scale-125 group-active:scale-150 ${dotColorClass} ${dotSizeClass}`}
        />

        {/* Hover / Drag Percent Tooltip */}
        {showTooltip && (
          <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center whitespace-nowrap bg-white/85 backdrop-blur-md border border-neutral-200/80 shadow-xs text-neutral-600 text-[10px] font-medium px-2 py-0.5 rounded-full z-50 animate-in fade-in slide-in-from-right-1 duration-150">
            {state.percent}%
          </span>
        )}
      </div>
    </div>
  );
};
