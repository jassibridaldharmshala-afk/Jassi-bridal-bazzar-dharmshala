import { Children } from 'react';
import { cn } from '../../lib/utils';

export function Sheet({ open, className = '', children }) {
  if (!open) return null;
  return <div className={cn('fixed inset-0 z-[80] bg-black/40', className)}>{children}</div>;
}

export function SheetContent({ side = 'bottom', className = '', ...props }) {
  const sideClass = side === 'left'
    ? 'absolute inset-y-0 left-0 h-full w-80 max-w-[86vw]'
    : 'absolute inset-x-0 bottom-0 rounded-t-3xl';
  return <div className={cn(sideClass, 'bg-white shadow-2xl', className)} {...props} />;
}

export function SheetHeader({ className = '', ...props }) {
  return <div className={cn('flex items-center justify-between gap-3 p-4', className)} {...props} />;
}

export function SheetTitle({ className = '', ...props }) {
  const { children, ...rest } = props;
  if (!Children.toArray(children).length) return null;
  return <h2 className={cn('section-title text-xl', className)} {...rest}>{children}</h2>;
}
