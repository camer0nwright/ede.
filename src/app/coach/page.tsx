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
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <p className="text-sm font-medium text-primary-strong">Coach</p>
        <h1 className="font-display text-5xl leading-none uppercase">Ask your coach</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your AI coach knows your plan, your check-ins and your lifts. It can explain sessions and suggest changes,
          which you approve.
        </p>
      </header>
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed p-8 text-center">
        <MessageCircle className="size-8 text-primary-strong" aria-hidden />
        <p className="font-medium">Coming soon</p>
        <p className="text-sm text-muted-foreground">Questions people will be able to ask:</p>
        <ul className="flex flex-col gap-2">
          {EXAMPLES.map((q) => (
            <li key={q} className="rounded-full bg-secondary px-4 py-2 text-sm">
              {q}
            </li>
          ))}
        </ul>
      </section>
      <MedicalNotice />
    </main>
  );
}
