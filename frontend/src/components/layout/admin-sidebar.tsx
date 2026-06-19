"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  ArrowLeftRight,
  ClipboardCheck,
  UserCog,
  FileSpreadsheet,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Tổng quan" },
  { href: "/admin/shifts", icon: Calendar, label: "Lịch trực" },
  { href: "/admin/assignments", icon: Users, label: "Phân công" },
  { href: "/admin/requests", icon: ArrowLeftRight, label: "Yêu cầu" },
  { href: "/admin/attendance", icon: ClipboardCheck, label: "Điểm danh" },
  { href: "/admin/volunteers", icon: UserCog, label: "Tình nguyện viên" },
  { href: "/admin/reports", icon: FileSpreadsheet, label: "Báo cáo" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r min-h-screen">
      <div className="p-6 border-b">
        <h1 className="font-bold text-blue-700 text-lg leading-tight">
          Quản lý Lịch Trực
        </h1>
        <p className="text-xs text-gray-500 mt-1">Ban Nhân Sự</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
