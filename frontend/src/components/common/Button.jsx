export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#2f5cff] text-white hover:bg-[#264ee4] shadow-[0_12px_24px_-16px_rgba(47,92,255,0.8)]',
    secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    ghost: 'text-slate-700 hover:bg-slate-100',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
