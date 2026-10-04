export default function Card({ children, className = '', title, subtitle, ...props }) {
  return (
    <section className={`glass-card hover-lift p-6 ${className}`} {...props}>
      {title && (
        <header className="mb-5">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
