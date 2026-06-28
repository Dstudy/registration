'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, ArrowLeftRight } from 'lucide-react';

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

export function VolunteerTopNav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="flex items-center justify-center flex-wrap gap-1 min-w-0">
      {navList.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center justify-center gap-2 bg-brand-bg border border-brand-blue px-4 py-2.5 text-xs md:text-sm font-bold tracking-wide transition-colors whitespace-nowrap text-brand-blue',
            isActive(item.href)
              ? 'text-brand-red'
              : '',
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
