import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type BaseProps = {
  label?: string;
  helperText?: string;
  wrapperClassName?: string;
};

export function TextInput({
  label,
  helperText,
  wrapperClassName = '',
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & BaseProps) {
  return (
    <label className={`block space-y-2 ${wrapperClassName}`}>
      {label && <span className="section-label block">{label}</span>}
      <input className={`input-shell h-12 rounded-[var(--radius-input)] ${className}`} {...props} />
      {helperText && <span className="caption-text block">{helperText}</span>}
    </label>
  );
}

export function TextAreaInput({
  label,
  helperText,
  wrapperClassName = '',
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps) {
  return (
    <label className={`block space-y-2 ${wrapperClassName}`}>
      {label && <span className="section-label block">{label}</span>}
      <textarea className={`input-shell min-h-28 rounded-[var(--radius-input)] px-4 py-3 ${className}`} {...props} />
      {helperText && <span className="caption-text block">{helperText}</span>}
    </label>
  );
}

