import { Children } from 'react';
import { cn } from '../../lib/utils';

export function Dialog({ open, className = '', children }) {
  if (!open) return null;
  return <div className={cn('fixed inset-0 z-[90] bg-black/45', className)}>{children}</div>;
}

export function DialogContent({ className = '', ...props }) {
  return <div className={cn('mx-auto w-full max-w-lg rounded-3xl bg-white shadow-2xl', className)} {...props} />;
}

export function DialogHeader({ className = '', ...props }) {
  return <div className={cn('flex items-center justify-between gap-3 p-4 md:p-5', className)} {...props} />;
}

export function DialogTitle({ className = '', ...props }) {
  const { children, ...rest } = props;
  const content = Children.toArray(children);
  if (!content.length) return null;
  return <h2 className={cn('section-title text-xl', className)} {...rest}>{content}</h2>;
}

export function DialogBody({ className = '', ...props }) {
  return <div className={cn('p-4 pt-0 md:p-5 md:pt-0', className)} {...props} />;
}
