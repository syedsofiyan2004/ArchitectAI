import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      isLoading = false,
      children,
      className = '',
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const variantClass = `ui-btn-${variant}`;
    const sizeClass = `ui-btn-${size}`;
    const combinedClass = `ui-btn ${variantClass} ${sizeClass} ${className}`.trim();

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={combinedClass}
        {...rest}
      >
        {isLoading ? (
          <span className="ui-btn-spinner" aria-hidden="true" />
        ) : (
          icon && <span className="ui-btn-icon-start">{icon}</span>
        )}
        <span className="ui-btn-text">{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary';
  size?: 'sm' | 'md';
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const variantClass = `ui-icon-btn-${variant}`;
    const sizeClass = `ui-icon-btn-${size}`;
    const combinedClass = `ui-icon-btn ${variantClass} ${sizeClass} ${className}`.trim();

    return (
      <button
        ref={ref}
        type={type}
        className={combinedClass}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
