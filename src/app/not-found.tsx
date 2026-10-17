import { ProblemPage } from "@/components/problem-page";

export const metadata = { title: "Not found · ede." };

/** Shown for addresses that don't exist, or sessions and weeks that aren't yours or aren't in your plan. */
export default function NotFound() {
  return (
    <ProblemPage title="That page isn't here">
      It may have moved, or the link may be wrong. If it was a week or a session, your plan may have changed since.
    </ProblemPage>
  );
}
