"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useAppStore } from "@/store/useAppStore";
import { addDays, startOfWeek, toISODate } from "@/lib/utils";
import { EventFormSheet } from "./EventFormSheet";
import { JournalSheet } from "./JournalSheet";
import { ChevronLeft, ChevronRight, CalendarDays, NotebookPen } from "lucide-react";
import type { InternshipEvent } from "@/lib/types";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const RANGE_START = 8; // 08:00
const RANGE_END = 20; // 20:00
const ROW_HEIGHT = 44;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function WeeklyCalendar({ internshipId }: { internshipId: string }) {
  const events = useAppStore((s) => s.internshipEvents);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [eventSheet, setEventSheet] = useState<{ open: boolean; date?: string; editing?: InternshipEvent | null }>({
    open: false,
  });
  const [journalDate, setJournalDate] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const hours = useMemo(
    () => Array.from({ length: RANGE_END - RANGE_START }, (_, i) => RANGE_START + i),
    []
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, InternshipEvent[]>();
    for (const day of days) {
      map.set(toISODate(day), events.filter((e) => e.date === toISODate(day) && e.internshipId === internshipId));
    }
    return map;
  }, [days, events, internshipId]);

  const todayISO = toISODate(new Date());
  const totalHeight = hours.length * ROW_HEIGHT;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <button
          onClick={() => setWeekAnchor(addDays(weekStart, -7))}
          className="rounded-full p-1.5 text-white/50 hover:bg-white/10"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/70">
          <CalendarDays size={13} className="text-brand-400" />
          {days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} –{" "}
          {days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </p>
        <button
          onClick={() => setWeekAnchor(addDays(weekStart, 7))}
          className="rounded-full p-1.5 text-white/50 hover:bg-white/10"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="no-scrollbar overflow-x-auto">
        <div style={{ minWidth: 620 }}>
          <div className="flex border-b border-white/8">
            <div className="w-10 shrink-0" />
            {days.map((day, i) => {
              const iso = toISODate(day);
              const isToday = iso === todayISO;
              return (
                <button
                  key={iso}
                  onClick={() => setJournalDate(iso)}
                  className="flex flex-1 flex-col items-center gap-0.5 border-l border-white/5 py-2 hover:bg-white/[0.03]"
                >
                  <span className="text-[10px] text-white/40">{DAY_LABELS[i]}</span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-brand-500 text-white" : "text-white/70"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <NotebookPen size={10} className="text-white/25" />
                </button>
              );
            })}
          </div>

          <div className="relative flex max-h-[380px] overflow-y-auto" style={{ height: totalHeight }}>
            <div className="w-10 shrink-0">
              {hours.map((h) => (
                <div key={h} style={{ height: ROW_HEIGHT }} className="border-b border-white/5 pr-1.5 text-right">
                  <span className="text-[9px] text-white/30">{h}:00</span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const iso = toISODate(day);
              const dayEvents = eventsByDay.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  className="relative flex-1 border-l border-white/5"
                  onClick={() => setEventSheet({ open: true, date: iso, editing: null })}
                >
                  {hours.map((h) => (
                    <div key={h} style={{ height: ROW_HEIGHT }} className="border-b border-white/5" />
                  ))}
                  {dayEvents.map((event) => {
                    const startMin = timeToMinutes(event.startTime) - RANGE_START * 60;
                    const endMin = timeToMinutes(event.endTime) - RANGE_START * 60;
                    const top = Math.max(0, (startMin / 60) * ROW_HEIGHT);
                    const height = Math.max(20, ((endMin - startMin) / 60) * ROW_HEIGHT);
                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEventSheet({ open: true, editing: event });
                        }}
                        style={{ top, height }}
                        className="absolute inset-x-0.5 overflow-hidden rounded-md bg-brand-500/25 px-1 py-0.5 text-left ring-1 ring-brand-400/40"
                      >
                        <p className="truncate text-[9px] font-semibold text-brand-200">{event.title}</p>
                        <p className="truncate text-[8px] text-brand-300/70">{event.startTime}</p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <EventFormSheet
        open={eventSheet.open}
        onClose={() => setEventSheet({ open: false })}
        internshipId={internshipId}
        defaultDate={eventSheet.date}
        editing={eventSheet.editing}
      />
      <JournalSheet open={journalDate !== null} onClose={() => setJournalDate(null)} date={journalDate ?? ""} />
    </Card>
  );
}
