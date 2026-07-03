"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import {
  Clock,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import EllipseRings from "@/components/ui/ellipse-rings";

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
    <>
      <div className="flex gap-3 mt-10 px-10 md:px-16">
        <EllipseRings size={60} />
        <div className="pt-3">
          <h1 className="text-3xl md:text-5xl font-normal text-brand-blue">
            Xin chào {user?.fullname || user?.ma_tnv}!
          </h1>
          <p className="mt-3 text-brand-blue font-normal">
            Tháng này bạn đang có: {String(monthShiftCount).padStart(2, "0")}{" "}
            lịch trông
          </p>
        </div>
      </div>

      <Link
        href="/calendar"
        className="h-[180px] md:h-[300px] lg:h-[450px] rounded-tl-[40px] md:rounded-tl-[60px] pl-14 pt-5 md:pl-20 md:pt-10 lg:pl-28 lg:pt-16 text-sm md:text-base font-bold tracking-wide text-white fixed bottom-0 w-full flex gap-2 z-1 bg-brand-orange hover:bg-[#ef9500] transition-all"
      >
        <CheckCircle2 className="h-5 w-5 mt-0.5" />
        ĐĂNG KÝ TRÔNG THƯ VIỆN
      </Link>
      <Link
        href="/my-shifts"
        className="h-[120px] md:h-[200px] lg:h-[300px] rounded-tl-[40px] md:rounded-tl-[60px] ml-14 md:ml-20 lg:ml-28 pl-14 pt-5 md:pl-20 md:pt-10 lg:pl-28 lg:pt-16 text-sm md:text-base font-bold tracking-wide text-white fixed bottom-0 w-full flex gap-2 z-2 bg-brand-blue hover:bg-[#3b4ac8] transition-all"
      >
        <Clock className="h-5 w-5 mt-0.5" />
        CA TRÔNG CỦA TÔI
      </Link>
      <Link
        href="/requests"
        className="h-[60px] md:h-[100px] lg:h-[150px] rounded-tl-[40px] md:rounded-tl-[60px] ml-28 md:ml-40 lg:ml-56 pl-14 pt-5 md:pl-20 md:pt-10 lg:pl-28 lg:pt-16 text-sm md:text-base font-bold tracking-wide text-white fixed bottom-0 w-full flex gap-2 z-3 bg-brand-blue-light hover:bg-[#6fb3f1] transition-all"
      >
        <ArrowLeftRight className="h-5 w-5 mt-0.5" />
        YÊU CẦU CA TRỰC
      </Link>
    </>
  );
}
