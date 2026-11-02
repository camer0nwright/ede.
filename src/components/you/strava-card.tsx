"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { disconnectStravaAction } from "@/app/(app)/you/actions";
import { Note } from "@/components/onboarding/choices";
import { safely } from "@/lib/safely";

/** What happened on Strava's screen, from ?strava= after it sends the athlete back. */
const RESULT: Record<string, { text: string; tone?: "caution" }> = {
  connected: { text: "Strava is connected." },
  cancelled: { text: "Strava wasn't connected. You can try again any time.", tone: "caution" },
  "no-upload": { text: "ede. needs permission to upload your activities. Connect again and leave that box ticked.", tone: "caution" },
  failed: { text: "Strava couldn't be connected just now. Try again in a moment.", tone: "caution" },
};

/** Connecting Strava, to send runs recorded in the app there (SPEC decision 83). */
export function StravaCard({ connected, result }: { connected: boolean; result?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const message = result ? RESULT[result] : undefined;
  const card = useRef<HTMLElement>(null);

  // Coming back from Strava: the page loads in parts, so #strava alone doesn't reach the card.
  useEffect(() => {
    if (result) card.current?.scrollIntoView({ block: "center" });
  }, [result]);

  const disconnect = () =>
    startTransition(async () => {
      const r = await safely(() => disconnectStravaAction());
      if (!r.ok) return void toast(r.errors[0]);
      setConfirm(false);
      toast("Strava is disconnected.");
      router.replace("/you#strava");
      router.refresh();
    });

  return (
    <section ref={card} id="strava" aria-label="Strava" className="scroll-mt-6 border bg-card p-6">
      <h2 className="font-heading text-xl font-medium tracking-tight">Strava</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send runs you record in the ede. iPhone app to Strava. ede. only asks to upload: it never reads anything from your Strava account.
      </p>
      {message && !(result === "connected" && !connected) && (
        <div className="mt-3">
          <Note tone={message.tone}>{message.text}</Note>
        </div>
      )}
      {connected ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Check className="size-4 text-easy" aria-hidden /> Connected
          </span>
          {confirm ? (
            <span className="flex gap-3">
              <button type="button" className="text-muted-foreground" onClick={() => setConfirm(false)} disabled={pending}>
                Keep it
              </button>
              <button type="button" className="font-medium text-destructive disabled:opacity-50" onClick={disconnect} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-label="Disconnecting" /> : "Disconnect"}
              </button>
            </span>
          ) : (
            <button type="button" className="font-medium text-primary-strong" onClick={() => setConfirm(true)}>
              Disconnect
            </button>
          )}
        </div>
      ) : (
        // A plain link: the route sends the browser on to Strava's own screen.
        <a
          href="/api/strava/connect"
          className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-[#FC5200] px-5 font-semibold text-white active:scale-[0.99]"
        >
          Connect with Strava
        </a>
      )}
    </section>
  );
}
