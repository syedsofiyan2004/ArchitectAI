import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'custom';
  maxWidth?: string;
  ariaLabelledBy?: string;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  maxWidth,
  ariaLabelledBy,
  className = '',
  backdropClassName = '',
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = size ? `ui-modal-${size}` : '';
  const inlineStyle: React.CSSProperties = maxWidth ? { maxWidth } : {};

  return (
    <div
      className={`ui-modal-backdrop ${backdropClassName}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        style={inlineStyle}
        className={`ui-modal-container ${sizeClass} ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
};

export interface ModalHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  titleId?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  icon,
  subtitle,
  onClose,
  titleId,
  className = '',
  children,
}) => {
  return (
    <div className={`ui-modal-header ${className}`.trim()}>
      <div className="ui-modal-header-info">
        <div className="ui-modal-title-row">
          {icon && <span className="ui-modal-header-icon">{icon}</span>}
          <h2 id={titleId} className="ui-modal-title">
            {title}
          </h2>
        </div>
        {subtitle && <p className="ui-modal-subtitle">{subtitle}</p>}
      </div>
      <div className="ui-modal-header-actions">
        {children}
        {onClose && (
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </IconButton>
        )}
      </div>
    </div>
  );
};

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  children: React.ReactNode;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  noPadding = false,
  className = '',
  ...rest
}) => {
  const paddingClass = noPadding ? 'ui-modal-body-no-padding' : '';
  return (
    <div className={`ui-modal-body ${paddingClass} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
};

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <div className={`ui-modal-footer ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
};
