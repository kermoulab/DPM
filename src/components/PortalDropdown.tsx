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
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  const calculatePosition = React.useCallback(
    (node?: HTMLElement | null) => {
      const trigger = triggerRef.current;
      if (!trigger) return null;

      const rect = trigger.getBoundingClientRect();
      const el = node || dropdownRef.current;
      const dropdownWidth = typeof width === 'number' ? width : (el?.offsetWidth || 160);
      // Realistic default height for action dropdown (2-3 items) if not yet rendered
      const dropdownHeight = el && el.offsetHeight > 0 ? el.offsetHeight : 80;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let showAbove = false;
      if (placement === 'top-end' || placement === 'top-start') {
        showAbove = true;
      } else if (placement === 'auto') {
        showAbove = spaceBelow < dropdownHeight + 10 && spaceAbove > spaceBelow;
      }

      let top = showAbove ? rect.top - dropdownHeight - 6 : rect.bottom + 6;

      // Boundary protection for top and bottom
      if (top < 8) top = 8;
      if (top + dropdownHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - dropdownHeight - 8);
      }

      // Default right-aligned to trigger button
      let left = rect.right - dropdownWidth;

      // Viewport horizontal edge boundaries
      if (left < 10) left = 10;
      if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }

      return {
        top: Math.round(top),
        left: Math.round(left)
      };
    },
    [triggerRef, width, placement]
  );

  const [coords, setCoords] = React.useState<{ top: number; left: number }>(() => {
    const initial = calculatePosition();
    return initial || { top: 0, left: 0 };
  });

  const updatePosition = React.useCallback(
    (node?: HTMLElement | null) => {
      const pos = calculatePosition(node);
      if (!pos) return;
      const el = node || dropdownRef.current;
      if (el) {
        el.style.top = `${pos.top}px`;
        el.style.left = `${pos.left}px`;
      }
      setCoords(pos);
    },
    [calculatePosition]
  );

  const setDropdownNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      dropdownRef.current = node;
      if (node) {
        updatePosition(node);
      }
    },
    [updatePosition]
  );

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

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={setDropdownNode}
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
