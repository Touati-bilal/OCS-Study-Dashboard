"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleTabs } from "@/components/modules/ModuleTabs";
import { InternshipCard } from "@/components/planning/InternshipCard";
import { WeeklyCalendar } from "@/components/planning/WeeklyCalendar";
import { JournalList } from "@/components/planning/JournalList";
import { ExamList } from "@/components/planning/ExamList";
import { useAppStore } from "@/store/useAppStore";

const TABS = [
  { id: "stage", label: "Stage" },
  { id: "journal", label: "Journal" },
  { id: "examens", label: "Examens" },
];

export default function PlanningHubPage() {
  const [tab, setTab] = useState("stage");
  const internships = useAppStore((s) => s.internships);
  const currentInternship = internships[0];

  return (
    <>
      <PageHeader title="Planning Hub" subtitle="Stage & examens" />
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} color="#48a3ff" />

      <div className="flex flex-col gap-4 px-5 py-4 md:px-8 lg:px-10">
        {tab === "stage" && (
          <>
            <InternshipCard />
            {currentInternship ? (
              <WeeklyCalendar internshipId={currentInternship.id} />
            ) : (
              <p className="text-center text-xs text-ink/35">
                Crée un stage pour activer le calendrier hebdomadaire.
              </p>
            )}
          </>
        )}

        {tab === "journal" && <JournalList />}

        {tab === "examens" && <ExamList />}
      </div>
    </>
  );
}
