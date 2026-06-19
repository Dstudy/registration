"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDaysInMonth, startOfMonth, getDay } from "date-fns";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ShiftInstance {
  id: number;
  date: string;
  shiftName: string;
  position: "PLACE_1" | "PLACE_2";
  startTime: string;
  endTime: string;
  maxSlots: number;
  isActive: boolean;
  isPublished: boolean;
  registrationCount: number;
  isUserRegistered: boolean;
  userRegistrationId: number | null;
}

const locationLabel: Record<ShiftInstance["position"], string> = {
  PLACE_1: "CƠ SỞ 1",
  PLACE_2: "CƠ SỞ 2",
};

const weekdayName = [
  "Chủ Nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];
const weekDayHeaders = ["T3", "T4", "T5", "T6", "T7", "CN"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// startTime/endTime are stored with their Vietnam-local hour baked into the UTC fields
function formatShiftTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

type DayStatus = "selected" | "available" | "full" | "empty";

function getDayStatus(shifts: ShiftInstance[]): DayStatus {
  if (!shifts.length) return "empty";
  if (shifts.some((s) => s.isUserRegistered)) return "selected";
  if (shifts.some((s) => s.isActive && s.registrationCount < s.maxSlots))
    return "available";
  return "full";
}

const dayStatusClass: Record<DayStatus, string> = {
  selected: "bg-orange-500 text-white",
  available: "bg-blue-600 text-white",
  full: "bg-gray-900 text-white",
  empty: "bg-gray-200 text-gray-400",
};

interface DayPanelProps {
  date: Date;
  shifts: ShiftInstance[];
  isRegistrationOpen: boolean;
  onConfirm: (shiftIds: number[]) => void;
  onCancel: (shiftId: number) => void;
  isMutating: boolean;
}

function DayPanel({
  date,
  shifts,
  isRegistrationOpen,
  onConfirm,
  onCancel,
  isMutating,
}: DayPanelProps) {
  const [selected, setSelected] = useState<number[]>([]);

  // Drop selections that are no longer pickable once the underlying data refreshes
  useEffect(() => setSelected([]), [shifts]);

  const groups = useMemo(() => {
    const map = new Map<string, ShiftInstance[]>();
    for (const shift of shifts) {
      const list = map.get(shift.position) ?? [];
      list.push(shift);
      map.set(shift.position, list);
    }
    return Array.from(map.values());
  }, [shifts]);

  const toggle = (shift: ShiftInstance) => {
    const isFull = shift.registrationCount >= shift.maxSlots;
    if (
      !isRegistrationOpen ||
      !shift.isActive ||
      isFull ||
      shift.isUserRegistered
    )
      return;
    setSelected((prev) =>
      prev.includes(shift.id)
        ? prev.filter((id) => id !== shift.id)
        : [...prev, shift.id],
    );
  };

  const dateLabel = `${weekdayName[date.getUTCDay()]}, Ngày ${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;

  return (
    <div className="w-full h-4/5 flex flex-col gap-3 rounded-tr-[2rem] bg-blue-50 border border-blue-100 p-4 shadow-xl">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group[0].position} className="flex-1 flex flex-col gap-2">
            <p className="text-base font-semibold leading-snug shrink-0">
              <span className="text-blue-700">{dateLabel}</span>
              {" | "}
              <span className="text-orange-600">
                {locationLabel[group[0].position]}
              </span>
            </p>
            <div className="flex-1 flex flex-col gap-1.5">
              {group.map((shift) => {
                const isFull = shift.registrationCount >= shift.maxSlots;
                const checked = selected.includes(shift.id);
                const selectable =
                  isRegistrationOpen &&
                  shift.isActive &&
                  !isFull &&
                  !shift.isUserRegistered;
                return (
                  <div
                    key={shift.id}
                    className={cn(
                      "flex-1 flex items-center justify-between gap-2 rounded-tr-xl px-4 py-2.5 text-sm font-bold tracking-wide",
                      shift.isUserRegistered
                        ? "bg-orange-500 text-white"
                        : isFull || !shift.isActive
                          ? "bg-gray-900 text-white"
                          : "bg-blue-600 text-white",
                    )}
                  >
                    <span className="truncate">
                      {shift.shiftName.toUpperCase()}:{" "}
                      {formatShiftTime(shift.startTime)} -{" "}
                      {formatShiftTime(shift.endTime)}
                    </span>
                    {shift.isUserRegistered ? (
                      <button
                        type="button"
                        onClick={() => onCancel(shift.id)}
                        disabled={isMutating}
                        className="shrink-0 rounded-tr bg-white/20 px-2.5 py-1.5 text-xs hover:bg-white/30 disabled:opacity-50"
                      >
                        HỦY
                      </button>
                    ) : selectable ? (
                      <label className="flex shrink-0 items-center gap-1.5 cursor-pointer select-none">
                        <span>CHỌN</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(shift)}
                          className="h-5 w-5 rounded-tr-sm accent-white"
                        />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-blue-200 pt-3 shrink-0">
        <button
          type="button"
          onClick={() => onConfirm(selected)}
          disabled={!selected.length || isMutating}
          className="w-full rounded-tr-full bg-orange-500 py-3 text-sm font-bold tracking-wide text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isMutating ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            "XÁC NHẬN ĐĂNG KÝ"
          )}
        </button>
      </div>
    </div>
  );
}

interface DayCellProps {
  day: number;
  shifts: ShiftInstance[];
  isHovered: boolean;
  isLocked: boolean;
  onHover: (day: number) => void;
  onLeave: () => void;
  onToggleLock: (day: number) => void;
}

function DayCell({
  day,
  shifts,
  isHovered,
  isLocked,
  onHover,
  onLeave,
  onToggleLock,
}: DayCellProps) {
  const status = getDayStatus(shifts);
  const hasShifts = shifts.length > 0;

  return (
    <div
      onMouseEnter={() => hasShifts && onHover(day)}
      onMouseLeave={onLeave}
      onClick={() => hasShifts && onToggleLock(day)}
      className={cn(
        "w-full aspect-square rounded-tr-xl md:rounded-tr-2xl flex items-center justify-center text-sm md:text-base font-bold",
        dayStatusClass[status],
        hasShifts ? "cursor-pointer" : "cursor-default",
        (isHovered || isLocked) &&
          "ring-2 ring-blue-300 ring-offset-2 ring-offset-gray-50",
        isLocked && "ring-orange-400",
      )}
    >
      {day}
    </div>
  );
}

interface ShiftCalendarProps {
  month: string;
  isRegistrationOpen: boolean;
}

export function ShiftCalendar({
  month,
  isRegistrationOpen,
}: ShiftCalendarProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  // Single fetch for the whole month — the hover panel reuses this cached data, no per-hover API calls.
  const { data: shifts = [], isLoading } = useQuery<ShiftInstance[]>({
    queryKey: ["shifts", month],
    queryFn: () => api.get(`/shifts?month=${month}`).then((r) => r.data.data),
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    const handler = () =>
      queryClient.invalidateQueries({ queryKey: ["shifts", month] });
    socket.on("registration.created", handler);
    socket.on("registration.canceled", handler);
    return () => {
      socket.off("registration.created", handler);
      socket.off("registration.canceled", handler);
    };
  }, [isAuthenticated, month, queryClient]);

  const registerMutation = useMutation({
    mutationFn: (shiftId: number) => api.post("/registrations", { shiftId }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const reg = shifts.find((s) => s.id === shiftId);
      if (!reg?.userRegistrationId) return;
      await api.delete(`/registrations/${reg.userRegistrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", month] });
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      toast({ title: "Đã hủy đăng ký" });
    },
    onError: (err: any) => {
      toast({
        title: "Hủy thất bại",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    },
  });

  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async (shiftIds: number[]) => {
    if (!shiftIds.length) return;
    setConfirming(true);
    try {
      for (const id of shiftIds) {
        await registerMutation.mutateAsync(id);
      }
      toast({
        title: "Đăng ký thành công",
        description: "Kiểm tra email để xác nhận ca trực.",
      });
    } catch (err: any) {
      toast({
        title: "Đăng ký thất bại",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["shifts", month] });
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      setConfirming(false);
    }
  };

  const isMutating = confirming || cancelMutation.isPending;

  // Hovered/locked day is lifted here so the options panel can dock to the right of the grid.
  // Clicking a day pins ("locks") the panel open on that day until clicked again or another day is locked.
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [lockedDay, setLockedDay] = useState<number | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const showPanelFor = (day: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredDay(day);
  };
  const hidePanelSoon = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredDay(null), 150);
  };
  const toggleLock = (day: number) => {
    setLockedDay((prev) => (prev === day ? null : day));
  };

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  // Build the grid for Tue–Sun only (this org never schedules shifts on Monday)
  const [year, m] = month.split("-").map(Number);
  const daysInMonth = getDaysInMonth(new Date(year, m - 1));
  const firstDow = getDay(startOfMonth(new Date(year, m - 1)));
  const firstRenderedDow = firstDow === 1 ? 2 : firstDow; // skip Monday
  const leadingEmpty = firstRenderedDow === 0 ? 5 : firstRenderedDow - 2;

  const shiftsByDay = useMemo(() => {
    const map: Record<number, ShiftInstance[]> = {};
    for (const shift of shifts) {
      const day = new Date(shift.date).getUTCDate();
      if (!map[day]) map[day] = [];
      map[day].push(shift);
    }
    return map;
  }, [shifts]);

  // Drop the lock if the locked day no longer has any shifts (e.g. month changed)
  useEffect(() => {
    if (lockedDay !== null && !shiftsByDay[lockedDay]?.length)
      setLockedDay(null);
  }, [lockedDay, shiftsByDay]);

  const renderedDays = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(
        (day) => new Date(Date.UTC(year, m - 1, day)).getUTCDay() !== 1,
      ),
    [daysInMonth, year, m],
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // A locked (clicked) day pins the panel — hovering other days no longer changes it.
  // Only when nothing is locked does hovering preview a day's panel.
  const displayedDay = lockedDay ?? hoveredDay;
  const displayedShifts = displayedDay ? shiftsByDay[displayedDay] || [] : [];

  return (
    <div className="h-full rounded-3xl bg-gray-50 p-4 md:p-6 flex items-center gap-3 md:gap-6">
      <div className="hidden md:flex items-center justify-center shrink-0">
        <span className="text-xl lg:text-2xl font-bold text-blue-600 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
          Tháng {m}|{year}
        </span>
      </div>

      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="grid grid-cols-6 gap-2 w-full">
          {weekDayHeaders.map((d) => (
            <div
              key={d}
              className="text-center text-xs md:text-sm font-bold text-blue-600 pb-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-6 gap-2 w-full">
            {Array.from({ length: leadingEmpty }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {renderedDays.map((day) => (
              <DayCell
                key={day}
                day={day}
                shifts={shiftsByDay[day] || []}
                isHovered={hoveredDay === day}
                isLocked={lockedDay === day}
                onHover={showPanelFor}
                onLeave={hidePanelSoon}
                onToggleLock={toggleLock}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-900" />
            <span>Đã kín</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-600" />
            <span>Vẫn còn chỗ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span>Ca đã chọn</span>
          </div>
        </div>
      </div>

      {/* Docked options panel — shows on hover, and stays pinned ("locked") once a day is clicked */}
      <div className="hidden lg:flex flex-1 min-w-0 self-stretch items-start pt-9">
        {displayedDay !== null && displayedShifts.length > 0 && (
          <div
            onMouseEnter={() => showPanelFor(displayedDay)}
            onMouseLeave={hidePanelSoon}
            className="w-full h-full"
          >
            <DayPanel
              date={new Date(Date.UTC(year, m - 1, displayedDay))}
              shifts={displayedShifts}
              isRegistrationOpen={isRegistrationOpen}
              onConfirm={handleConfirm}
              onCancel={(id) => cancelMutation.mutate(id)}
              isMutating={isMutating}
            />
          </div>
        )}
      </div>
    </div>
  );
}
