import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl border border-transparent font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/15 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-wine text-[color:var(--site-on-fill)] shadow-sm hover:bg-wine/92',
        accent: 'bg-rose text-[color:var(--site-on-fill)] shadow-sm hover:bg-rose/92',
        secondary: 'border-[color:var(--site-border)] bg-[color:var(--site-surface)] text-charcoal hover:border-[color:var(--site-border)] hover:bg-[color:var(--site-background)]',
        ghost: 'bg-transparent text-[color:var(--site-muted)] hover:bg-[color:var(--site-surface-alt)]',
        outline: 'border-[color:var(--site-border)] bg-[color:var(--site-surface)] text-charcoal hover:bg-blush hover:border-rose/30',
      },
      size: {
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-11 px-4 text-[15px]',
        lg: 'h-12 px-5 text-[15px]',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export default function Button({ as: Component = 'button', variant = 'primary', size = 'md', className = '', type, ...props }) {
  return (
    <Component
      type={Component === 'button' ? type || 'button' : type}
      data-theme-action={['primary', 'accent'].includes(variant) && size !== 'icon' ? 'primary' : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
