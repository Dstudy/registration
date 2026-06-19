'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, ArrowLeftRight } from 'lucide-react';

const pillBase =
  'flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-xs md:text-sm font-bold tracking-wide transition-colors whitespace-nowrap';

export function VolunteerTopNav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="flex items-center justify-center gap-2 md:gap-3 flex-1 min-w-0 overflow-x-auto">
      <Link
        href="/calendar"
        className={cn(
          pillBase,
          isActive('/calendar')
            ? 'bg-brand-blue border-brand-blue text-white'
            : 'bg-white border-brand-blue text-brand-blue hover:bg-brand-blue/5',
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        ĐĂNG KÝ TRÔNG THƯ VIỆN
      </Link>

      <Link
        href="/my-shifts"
        className={cn(
          pillBase,
          isActive('/my-shifts')
            ? 'bg-brand-blue border-brand-blue text-white'
            : 'bg-white border-brand-blue text-brand-blue hover:bg-brand-blue/5',
        )}
      >
        <Clock className="h-4 w-4" />
        CA TRÔNG CỦA TÔI
      </Link>

      <Link
        href="/requests"
        className={cn(
          pillBase,
          isActive('/requests')
            ? 'bg-brand-blue border-brand-blue text-white'
            : 'bg-white border-brand-blue text-brand-blue hover:bg-brand-blue/5',
        )}
      >
        <ArrowLeftRight className="h-4 w-4" />
        YÊU CẦU CA TRỰC
      </Link>
    </nav>
  );
}
