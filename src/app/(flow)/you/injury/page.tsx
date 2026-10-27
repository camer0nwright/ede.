import { Suspense } from "react";
import { redirect } from "next/navigation";
import { START } from "@/components/onboarding/draft";
import { PageSkeleton } from "@/components/page-skeleton";
import { InjuryForm } from "@/components/you/injury-form";
import { getPlanContext } from "@/server/athlete";

export const metadata = { title: "Injury · ede." };

export default function InjuryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Injury />
    </Suspense>
  );
}

async function Injury() {
  const ctx = await getPlanContext();
  if (ctx.isDemo) redirect("/you");
  const i = ctx.injury;
  return (
    <InjuryForm
      updating={!!i}
      needsConsent={!ctx.healthConsentAt}
      initial={i ? { area: i.area, painLevel: i.painLevel, painWhen: i.painWhen, notes: i.notes ?? "" } : START.injury}
    />
  );
}
