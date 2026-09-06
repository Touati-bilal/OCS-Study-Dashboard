"use client";

import { BottomNav } from "./BottomNav";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full bg-base-950 md:flex md:min-h-screen md:items-center md:justify-center md:p-10">
      <div className="pointer-events-none fixed inset-0 hidden bg-grid-glow md:block" />

      <div className="pointer-events-none absolute left-1/2 top-24 hidden h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl md:block" />

      <div className="relative z-10 mx-auto w-full md:w-[380px]">
        <div className="md:rounded-[3rem] md:border-[10px] md:border-base-800 md:bg-black md:p-2 md:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)]">
          <div className="pointer-events-none absolute left-1/2 top-4 z-30 hidden h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black ring-2 ring-base-700 md:block" />

          <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-base-950 md:h-[780px] md:rounded-[2.3rem]">
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">{children}</div>
            <BottomNav />
          </div>
        </div>

        <div className="mt-2 hidden justify-center md:flex">
          <div className="h-1 w-24 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}
