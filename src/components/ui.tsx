import React, { useEffect, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }
>(({ className, variant = 'primary', ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-200',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  };

  return (
    <button
      ref={ref}
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, onWheel, ...props }, ref) => {
  return (
    <input
      ref={ref}
      onWheel={(e) => {
        if (props.type === 'number') {
          (e.target as HTMLInputElement).blur();
        }
        if (onWheel) onWheel(e);
      }}
      className={cn(
        'block w-full rounded-2xl border-0 bg-gray-100/80 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-2xl border-0 bg-gray-100/80 px-4 py-2 text-base text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all',
        className
      )}
      {...props}
    />
  );
});
Select.displayName = 'Select';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-gray-700 mb-1.5 block', className)}
      {...props}
    />
  );
});
Label.displayName = 'Label';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-3xl border border-gray-100 bg-white text-gray-950 shadow-sm', className)} {...props} />
));
Card.displayName = 'Card';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative bg-white w-full ${maxWidth} rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
          >
            <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
              <h3 className="text-xl font-bold text-gray-900">{title}</h3>
              <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ── Toast ── upgraded with type, auto-progress, and icon
type ToastType = 'success' | 'error' | 'warning' | 'info';

const toastStyles: Record<ToastType, { border: string; iconColor: string; bar: string; Icon: React.ElementType }> = {
  success: { border: 'border-emerald-500/40', iconColor: 'text-emerald-400', bar: 'bg-emerald-400', Icon: CheckCircle2 },
  error:   { border: 'border-red-500/40',     iconColor: 'text-red-400',     bar: 'bg-red-400',     Icon: XCircle },
  warning: { border: 'border-amber-500/40',   iconColor: 'text-amber-400',   bar: 'bg-amber-400',   Icon: AlertTriangle },
  info:    { border: 'border-sky-500/40',     iconColor: 'text-sky-400',     bar: 'bg-sky-400',     Icon: Info },
};

export const Toast = ({
  message,
  isVisible,
  icon,
  type = 'success',
  duration = 2500,
}: {
  message: string;
  isVisible: boolean;
  icon?: React.ReactNode;
  type?: ToastType;
  duration?: number;
}) => {
  const [progress, setProgress] = useState(100);
  const style = toastStyles[type];

  useEffect(() => {
    if (!isVisible) { setProgress(100); return; }
    setProgress(100);
    const step = 50;
    const decrement = (100 / duration) * step;
    const interval = setInterval(() => {
      setProgress(prev => Math.max(0, prev - decrement));
    }, step);
    return () => clearInterval(interval);
  }, [isVisible, duration, message]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -28, x: '-50%', scale: 0.92 }}
          animate={{ opacity: 1, y: 0,   x: '-50%', scale: 1 }}
          exit={{   opacity: 0, y: -20,  x: '-50%', scale: 0.95 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className={cn(
            'fixed top-20 left-1/2 z-[100] pointer-events-none',
            'bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden',
            'min-w-[220px] max-w-[92vw]',
            style.border
          )}
        >
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className={cn('shrink-0', style.iconColor)}>
              {icon ?? <style.Icon className="w-5 h-5 stroke-[2.2px]" />}
            </div>
            <span className="text-white font-semibold text-sm leading-snug">{message}</span>
          </div>
          {/* Progress drain bar */}
          <div className="h-[3px] w-full bg-white/10">
            <div
              className={cn('h-full rounded-full transition-none', style.bar)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Skeleton ── animated shimmer placeholder for loading states
export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-2xl bg-gray-100',
      'after:absolute after:inset-0 after:-translate-x-full',
      'after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent',
      'after:animate-[shimmer_1.5s_ease-in-out_infinite]',
      className
    )}
  />
);
