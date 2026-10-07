import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 badge-text font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        rose: 'bg-blush text-rose',
        wine: 'bg-wine text-white',
        success: 'bg-emerald-50 text-emerald-700',
        outline: 'border border-slate-200 bg-white text-slate-700',
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
