import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 badge-text font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-[color:var(--site-surface-alt)] text-[color:var(--site-muted)]',
        rose: 'bg-blush text-rose',
        wine: 'bg-wine text-[color:var(--site-on-fill)]',
        success: 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]',
        outline: 'border border-[color:var(--site-border)] bg-[color:var(--site-surface)] text-[color:var(--site-muted)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Badge({ className = '', variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
