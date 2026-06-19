export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="6" width="8" height="28" rx="1.5" stroke="#4F5FE8" strokeWidth="2.5" />
        <rect x="14" y="3" width="8" height="31" rx="1.5" stroke="#4F5FE8" strokeWidth="2.5" />
        <path d="M25 8 L36 11 L31 33 L20 30 Z" stroke="#4F5FE8" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <span className="leading-tight font-extrabold text-brand-blue text-sm">
        thư viện<br />dương liễu
      </span>
    </div>
  );
}
