import React from 'react';

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <div className={`ui-form-field ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
};

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({
  children,
  required,
  className = '',
  ...rest
}) => {
  return (
    <label className={`ui-label ${className}`.trim()} {...rest}>
      <span>{children}</span>
      {required && (
        <span className="ui-label-required" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', hasError = false, type = 'text', ...rest }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={`ui-input ${hasError ? 'ui-input-error' : ''} ${className}`.trim()}
        {...rest}
      />
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', hasError = false, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`ui-textarea ${hasError ? 'ui-textarea-error' : ''} ${className}`.trim()}
        {...rest}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export interface FormHintProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const FormHint: React.FC<FormHintProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <span className={`ui-form-hint ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
};

export interface FormErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const FormError: React.FC<FormErrorProps> = ({
  children,
  className = '',
  ...rest
}) => {
  if (!children) return null;
  return (
    <div className={`ui-form-error ${className}`.trim()} role="alert" {...rest}>
      {children}
    </div>
  );
};
