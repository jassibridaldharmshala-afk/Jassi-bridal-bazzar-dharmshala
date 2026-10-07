import { cn } from '../../lib/utils';

const baseControl = 'body-text h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-wine focus:ring-2 focus:ring-wine/10 disabled:bg-slate-50 disabled:text-slate-400';

export function TextInput({ className = '', ...props }) {
  return <input className={cn(baseControl, className)} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={cn(baseControl, 'label-text pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={cn(baseControl, 'h-auto min-h-24 resize-y py-3', className)} {...props} />;
}

export function FieldLabel({ className = '', ...props }) {
  return <label className={cn('label-text text-slate-500', className)} {...props} />;
}
