import { MessageCircle } from "lucide-react";
import { MedicalNotice } from "@/components/medical-notice";

export const metadata = { title: "Coach · ede." };

const EXAMPLES = [
  "Why is Thursday a hard session?",
  "Can I move my long run to Sunday?",
  "My calves are tight. What should I do?",
  "How should I fuel for my half marathon?",
];

export default function CoachPage() {
  return (
    <main className="flex flex-col gap-6 pt-6">
      <header>
        <p className="text-sm text-muted-foreground">Coming soon</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask about your plan, your sessions or how you feel. Your coach knows your plan, check-ins and lifts, and can
          suggest changes for you to approve.
        </p>
      </header>
      <section aria-label="Example questions">
        <h2 className="mb-1 font-semibold">Things you&apos;ll be able to ask</h2>
        <ul className="divide-y rounded-2xl border bg-card px-4">
          {EXAMPLES.map((q) => (
            <li key={q} className="flex items-center gap-3 py-3 text-sm">
              <MessageCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {q}
            </li>
          ))}
        </ul>
      </section>
      <MedicalNotice />
    </main>
  );
}
