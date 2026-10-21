// Sending email (SPEC decision 61), through Resend's API when RESEND_API_KEY
// is set. Without a key, development prints the email to the terminal so the
// flow can be tested for free; the live site logs only that email isn't set up
// (never the email itself, which may hold a sign-in link). Server only.
import "server-only";

export type Email = { to: string; subject: string; text: string; html: string };

/** The address emails come from, e.g. "ede. <hello@trainwithede.com>". */
const from = () => process.env.EMAIL_FROM?.trim() || "ede. <hello@trainwithede.com>";

/** The site's own address, for links in emails. Never taken from the request, so a forged Host header can't change where links point. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Sends an email. Returns false if it couldn't be sent (the caller shows the same message either way). */
export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("Email isn't set up (no RESEND_API_KEY), so an email wasn't sent.");
      return false;
    }
    console.log(`\n--- Email (not sent: no RESEND_API_KEY) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n---\n`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from(), to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) {
      console.error(`Sending email failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Sending email failed", e);
    return false;
  }
}
