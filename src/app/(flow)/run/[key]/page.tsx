import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { RunRecorder } from "@/components/run/run-recorder";
import { weekDays, type RunView } from "@/lib/week-view";
import { builtWeeks } from "@/server/athlete";
import { signedInContext } from "@/server/sessions";

export const metadata = { title: "Record run · ede." };

/** Recording a planned run with GPS in the iPhone app (SPEC decision 82). The key is "YYYY-MM-DD-slot". */
export default function RunPage({ params }: PageProps<"/run/[key]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RunContent params={params} />
    </Suspense>
  );
}

async function RunContent({ params }: { params: PageProps<"/run/[key]">["params"] }) {
  const { key } = await params;
  const match = /^(\d{4}-\d{2}-\d{2})-([12])$/.exec(key);
  if (!match) notFound();
  const ctx = await signedInContext();
  if (!ctx) redirect("/login");
  const [, date] = match;
  // A run can be recorded on its day (or one moved to today), not ahead of it.
  if (date > ctx.today) redirect("/");

  const week = builtWeeks(ctx).find((b) => b.week.sessions.some((s) => `${s.date}-${s.slot}` === key))?.week;
  const session = week && weekDays(week, ctx.paces, ctx.checkIns, ctx.workouts).flatMap((d) => d.sessions).find((s) => s.id === key);
  if (!session || session.type !== "run") notFound();
  if (session.checkIn) redirect("/");
  return <RunRecorder session={session as RunView} unit={ctx.paces.unit} />;
}
