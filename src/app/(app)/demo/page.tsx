import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { TodayScreen } from "@/components/today/today-screen";

export const metadata = { title: "Example plan · ede." };

/** The demo athlete's Today, linked from the front page as "See an example plan". */
export default function DemoPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TodayScreen demo />
    </Suspense>
  );
}
