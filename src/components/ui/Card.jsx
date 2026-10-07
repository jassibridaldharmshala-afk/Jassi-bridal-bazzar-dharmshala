import { Children } from 'react';
import { cn } from '../../lib/utils';

export function Card({ className = '', ...props }) {
  const { as: Component = 'div', ...rest } = props;
  return <Component className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', className)} {...rest} />;
}

export function CardHeader({ className = '', ...props }) {
  return <div className={cn('flex flex-col gap-1.5 p-4 md:p-5', className)} {...props} />;
}

export function CardTitle({ className = '', ...props }) {
  const children = Children.toArray(props.children);
  if (!children.length) return null;
  return <h3 className={cn('section-title text-xl text-charcoal', className)} {...props}>{children}</h3>;
}

export function CardDescription({ className = '', ...props }) {
  return <p className={cn('body-text text-slate-500', className)} {...props} />;
}

export function CardContent({ className = '', ...props }) {
  return <div className={cn('p-4 pt-0 md:p-5 md:pt-0', className)} {...props} />;
}

export function CardFooter({ className = '', ...props }) {
  return <div className={cn('flex items-center p-4 pt-0 md:p-5 md:pt-0', className)} {...props} />;
}
