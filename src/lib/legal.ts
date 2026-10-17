// Facts the privacy policy and terms state (SPEC decision 57). Kept here, next
// to the code that enforces them, so the pages and the app can't drift apart.

/** Shown at the top of both pages. Change when either page's meaning changes. */
export const LEGAL_UPDATED = "17 October 2026";

/** Youngest age that can use ede. */
export const MIN_AGE = 16;

/** A plan set up but never saved to an account is deleted after this many days (the cookie lasts as long). */
export const UNSAVED_PLAN_DAYS = 30;

/**
 * Who to contact about privacy. Set PRIVACY_CONTACT_EMAIL in the environment
 * before launch; the pages say it's coming until then.
 */
export const privacyContact = () => process.env.PRIVACY_CONTACT_EMAIL?.trim() || null;
