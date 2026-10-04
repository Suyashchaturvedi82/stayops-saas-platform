export default function Input({ label, type = 'text', error, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>}
      <input
        type={type}
        className={`w-full rounded-xl border px-4 py-2.5 text-slate-900 outline-none transition ${
          error
            ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100'
            : 'border-slate-200 bg-white focus:border-[#2f5cff] focus:ring-4 focus:ring-blue-100'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
