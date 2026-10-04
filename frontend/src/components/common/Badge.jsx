export default function Badge({ children, type = 'info' }) {
  const styles = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-rose-100 text-rose-800 border-rose-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles[type]}`}>
      {children}
    </span>
  );
}
