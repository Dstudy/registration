'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, ArrowLeftRight, Menu, X } from 'lucide-react';

const navList = [
  {
    href: '/calendar',
    label: 'ĐĂNG KÝ TRÔNG THƯ VIỆN',
    icon: CheckCircle2,
  },
  {
    href: '/my-shifts',
    label: 'CA TRÔNG CỦA TÔI',
    icon: Clock,
  },
  {
    href: '/requests',
    label: 'YÊU CẦU CA TRỰC',
    icon: ArrowLeftRight,
  },
];

// ── Shared nav link ──────────────────────────────────────────────────────────
function NavLink({
  href,
  label,
  Icon,
  isActive,
}: {
  href: string;
  label: string;
  Icon: React.ElementType;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 sm:gap-2 border px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold tracking-wide transition-colors whitespace-nowrap shrink-0 rounded-sm',
        isActive
          ? 'text-brand-red border-brand-red bg-red-50/30'
          : 'bg-brand-bg border-brand-blue text-brand-blue hover:bg-blue-50/30',
      )}
    >
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

// ── Mobile hamburger (< sm / < 640px) ───────────────────────────────────────
// Placed inside the header's right corner via layout.tsx
export function VolunteerHamburger() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative sm:hidden" ref={menuRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        className={cn(
          'flex items-center justify-center w-8 h-8 border rounded-sm transition-colors',
          open
            ? 'border-brand-red text-brand-red bg-red-50/30'
            : 'border-brand-blue text-brand-blue bg-brand-bg hover:bg-blue-50/30',
        )}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 flex flex-col min-w-[230px] bg-white border border-gray-200 rounded-sm shadow-lg overflow-hidden">
          {navList.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-xs font-bold tracking-wide transition-colors whitespace-nowrap border-b last:border-b-0 border-gray-100',
                isActive(item.href)
                  ? 'text-brand-red bg-red-50/40 border-l-2 border-l-brand-red'
                  : 'text-brand-blue hover:bg-blue-50/40',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VolunteerTopNav ──────────────────────────────────────────────────────────
// inHeader=true  → renders nav links only (used inside the wide header grid)
// inHeader=false → renders the below-header row visible from sm to wide
export function VolunteerTopNav({ inHeader = false }: { inHeader?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const links = navList.map((item) => (
    <NavLink
      key={item.href}
      href={item.href}
      label={item.label}
      Icon={item.icon}
      isActive={isActive(item.href)}
    />
  ));

  if (inHeader) {
    // Rendered inside the wide header's center column — no wrapper needed,
    // visibility is handled by the parent <nav> in layout.tsx
    return <>{links}</>;
  }

  // Below-header row: visible sm → wide (hidden on mobile and on wide+)
  return (
    <nav className="hidden sm:flex wide:hidden items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 w-full overflow-x-auto py-1">
      {links}
    </nav>
  );
}
