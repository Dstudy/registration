"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import {
  Calendar,
  Clock,
  CheckCircle,
  Sparkles,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { vi } from "date-fns/locale";
import { ArchRow } from "@/components/brand/arches";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";

function formatDate(dateStr: string) {
  return format(new Date(dateStr), "EEEE, dd/MM/yyyy", { locale: vi });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  useEffect(() => {
    const confirmed = searchParams.get("confirmed");
    if (confirmed === "true") {
      toast({
        title: "Xác nhận thành công!",
        description: "Ca trực của bạn đã được xác nhận.",
      });
    } else if (confirmed === "false") {
      toast({
        title: "Xác nhận thất bại",
        description: "Token không hợp lệ hoặc đã hết hạn.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const { data: upcoming } = useQuery({
    queryKey: ["registrations", "upcoming"],
    queryFn: () =>
      api.get("/registrations/my?upcoming=true").then((r) => r.data.data),
  });

  const { data: past } = useQuery({
    queryKey: ["registrations", "past"],
    queryFn: () =>
      api.get("/registrations/my?upcoming=false").then((r) => r.data.data),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.get("/users/me").then((r) => r.data),
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthShiftCount =
    upcoming?.filter((r: any) => r.shift.date.startsWith(currentMonth))
      .length || 0;
  const daysJoined = profile?.date_joined
    ? Math.max(differenceInDays(new Date(), new Date(profile.date_joined)), 0)
    : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-white border px-6 py-8 md:px-10 md:py-10">
        <ArchRow
          color="#C7D2FE"
          count={4}
          radius={90}
          className="pointer-events-none absolute -top-6 right-0 w-[460px] opacity-60"
        />
        <div className="relative flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link
              href="/account"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 hover:opacity-80 transition-opacity"
            >
              {(user?.fullname || user?.ma_tnv || "")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Link>
          </div>
        </div>
        <div className="relative mt-6">
          <h1 className="text-3xl md:text-5xl font-extrabold text-brand-blue">
            Xin chào {user?.fullname || user?.ma_tnv}!
          </h1>
          <p className="mt-3 text-brand-blue font-bold">
            Tháng này bạn đang có: {String(monthShiftCount).padStart(2, "0")}{" "}
            lịch trông
          </p>
        </div>
      </div>

      {/* Quick links - cascading colored bars */}
      <div className="flex flex-col">
        <Link
          href="/calendar"
          className="relative z-10 flex items-center gap-2 rounded-3xl bg-brand-orange px-6 py-8 md:px-10 md:py-10 text-sm md:text-base font-bold tracking-wide text-white hover:opacity-90 transition-opacity"
        >
          <CheckCircle2 className="h-5 w-5" />
          ĐĂNG KÝ TRÔNG THƯ VIỆN
        </Link>
        <Link
          href="/my-shifts"
          className="relative z-20 -mt-6 ml-6 md:ml-12 flex items-center gap-2 rounded-3xl rounded-tl-[2.5rem] bg-brand-blue px-6 py-8 md:px-10 md:py-10 text-sm md:text-base font-bold tracking-wide text-white hover:opacity-90 transition-opacity"
        >
          <Clock className="h-5 w-5" />
          CA TRÔNG CỦA TÔI
        </Link>
        <Link
          href="/requests"
          className="relative z-30 -mt-6 ml-12 md:ml-24 flex items-center gap-2 rounded-3xl rounded-tl-[2.5rem] bg-brand-blue-light px-6 py-8 md:px-10 md:py-10 text-sm md:text-base font-bold tracking-wide text-white hover:opacity-90 transition-opacity"
        >
          <ArrowLeftRight className="h-5 w-5" />
          YÊU CẦU CA TRỰC
        </Link>
      </div>
    </div>
  );
}
