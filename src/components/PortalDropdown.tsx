import React from 'react';
import { createPortal } from 'react-dom';

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number | string;
  className?: string;
  placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start' | 'auto';
}

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  width = 224, // default w-56 (14rem = 224px)
  className = '',
  placement = 'auto'
}) => {
  const [coords, setCoords] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = typeof width === 'number' ? width : 220;
    const dropdownHeight = dropdownRef.current ? dropdownRef.current.offsetHeight : 240;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let showAbove = false;
    if (placement === 'top-end' || placement === 'top-start') {
      showAbove = true;
    } else if (placement === 'auto') {
      showAbove = spaceBelow < dropdownHeight + 10 && spaceAbove > spaceBelow;
    }

    let top = showAbove ? rect.top - dropdownHeight - 6 : rect.bottom + 6;

    // Boundary protection for top
    if (top < 8) top = 8;
    if (top + dropdownHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - dropdownHeight - 8);
    }

    // Default right-aligned to trigger button
    let left = rect.right - dropdownWidth;

    // If overflowing left edge of viewport
    if (left < 10) {
      left = 10;
    }

    // If overflowing right edge of viewport
    if (left + dropdownWidth > window.innerWidth - 10) {
      left = window.innerWidth - dropdownWidth - 10;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left)
    });
  }, [triggerRef, width, placement]);

  React.useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef, updatePosition]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: typeof width === 'number' ? `${width}px` : width,
        zIndex: 9999
      }}
      className={`bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-left ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};
