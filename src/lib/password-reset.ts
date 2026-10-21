// "Forgot password" (SPEC decision 61): how long a reset link lasts, when a
// link can't be used, and the email that carries it. Plain code; the server
// stores only a hash of each link's token.

/** A reset link works for this long, and only once. */
export const RESET_LINK_MINUTES = 60;

/** What every request is told, whether or not the email has an account, so the form can't be used to find out who does. */
export const RESET_REQUESTED = "If there's an account for that email, a link to reset the password is on its way. It works for an hour.";

export type ResetRow = { expiresAt: Date; usedAt: Date | null };

/** Why a reset link can't be used, or null if it can. */
export function resetLinkProblem(row: ResetRow | null, now: Date): string | null {
  if (!row) return "That reset link isn't valid. Ask for a new one.";
  if (row.usedAt) return "That reset link has already been used. Ask for a new one if you need to.";
  if (row.expiresAt <= now) return "That reset link has expired. Ask for a new one.";
  return null;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email with the reset link, as plain text and simple HTML. */
export function resetEmail(link: string, name?: string | null) {
  const hello = name?.trim() ? `Hi ${name.trim()},` : "Hi,";
  const lines = [
    hello,
    "",
    "Someone (hopefully you) asked to reset the password for your ede. account. Use this link to choose a new one:",
    "",
    link,
    "",
    `The link works once, for ${RESET_LINK_MINUTES} minutes. Choosing a new password logs out every device that's signed in.`,
    "",
    "If you didn't ask for this, you can ignore this email: your password stays the same.",
    "",
    "ede.",
  ];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:480px">
<p>${escape(hello)}</p>
<p>Someone (hopefully you) asked to reset the password for your ede. account.</p>
<p><a href="${escape(link)}" style="display:inline-block;background:#c4f24a;color:#18181b;font-weight:600;padding:12px 20px;border-radius:12px;text-decoration:none">Choose a new password</a></p>
<p style="color:#52525b;font-size:13px">The link works once, for ${RESET_LINK_MINUTES} minutes. Choosing a new password logs out every device that's signed in. If you didn't ask for this, ignore this email: your password stays the same.</p>
<p style="color:#52525b;font-size:13px">ede.</p>
</div>`;
  return { subject: "Reset your ede. password", text: lines.join("\n"), html };
}
