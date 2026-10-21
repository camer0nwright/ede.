import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { LEGAL_UPDATED, MIN_AGE, privacyContact, UNSAVED_PLAN_DAYS } from "@/lib/legal";
import { SESSION_DAYS } from "@/server/auth";
import { KEEP_HOURS } from "@/server/auth-limits";

export const metadata = { title: "Privacy · ede." };

/** The privacy policy (SPEC decision 57), in plain English. */
export default function PrivacyPage() {
  const contact = privacyContact();
  return (
    <LegalPage
      title="Privacy"
      updated={LEGAL_UPDATED}
      intro={<p>What ede. keeps about you, why, and how to see, change or delete it. The short version: only what your plan needs, never sold, never used for ads.</p>}
    >
      <LegalSection title="What ede. keeps">
        <ul>
          <li>
            <strong>Your account:</strong> your email, and your password as a one-way scrambled hash (no one can read it, including us).
          </li>
          <li>
            <strong>Your training profile:</strong> the name you give, your goal and race details, experience, recent running, 5K time, the days and time you can
            train, your equipment and units.
          </li>
          <li>
            <strong>Your training:</strong> your plan, sessions you mark done or skip (with time, distance, effort, notes and reasons), and the sets, weights and
            reps you log.
          </li>
          <li>
            <strong>Injury details, only if you add them:</strong> where it hurts, how much, when, your notes, and past injuries. These count as health data, so
            ede. only keeps them with your clear agreement (see below).
          </li>
          <li>
            <strong>Security records:</strong> which devices are signed in (as a scrambled code), password reset links (as a scrambled code, working once for an
            hour), and failed log-ins and reset requests (as a scrambled email and network address, deleted within {KEEP_HOURS} hours) to stop people guessing
            passwords.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why">
        <p>
          To build and adjust your plan and show your history: that&apos;s the service you sign up for. Security records keep accounts safe. Nothing is used for
          advertising, sold, or shared to build a profile of you.
        </p>
      </LegalSection>

      <LegalSection title="Injury details (health data)">
        <p>
          Injury details are kept only after you tick the box agreeing to it, and are used only to adjust your plan (for example, easing running while an ankle
          settles). You can change or remove them on the You page at any time, and withdraw your agreement there, which deletes them.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          ede. uses two cookies, both needed for it to work: one keeps you signed in (for up to {SESSION_DAYS} days), and one holds a plan you&apos;ve set up but
          not yet saved. There are no analytics, tracking or advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="Who else handles it">
        <ul>
          <li>
            <strong>Hosting:</strong> ede.&apos;s servers (Vercel) and database (Turso) are run by companies that store data for us and can&apos;t use it for anything else.
          </li>
          <li>
            <strong>Email:</strong> password reset emails are sent through Resend, which sees your email address and the email itself, only to deliver it.
          </li>
          <li>
            <strong>AI tailoring, when it&apos;s used:</strong> when you ask ede. to adjust your next week, your plan, recent check-ins (with any notes) and any injury
            details are sent to Anthropic (the maker of Claude) to do it. Your name and email are not. Anthropic doesn&apos;t use this to train its models.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How long">
        <p>
          For as long as you have an account. Deleting your data removes everything at once. A plan set up but never saved to an account is deleted after{" "}
          {UNSAVED_PLAN_DAYS} days.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <ul>
          <li>
            <strong>See and download it:</strong> You → Download my data gives you everything ede. holds about you.
          </li>
          <li>
            <strong>Correct it:</strong> change your details on the You page.
          </li>
          <li>
            <strong>Delete it:</strong> You → Delete my data removes your account and everything in it straight away.
          </li>
          <li>
            <strong>Withdraw agreement</strong> to keeping injury details, on the You page.
          </li>
          <li>
            <strong>Complain:</strong> if you&apos;re unhappy with how your data is handled, you can contact the UK Information Commissioner&apos;s Office (ico.org.uk).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Age">
        <p>ede. is for people aged {MIN_AGE} and over.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          {contact ? (
            <>
              Questions or requests: <a href={`mailto:${contact}`} className="text-foreground underline underline-offset-4">{contact}</a>.
            </>
          ) : (
            "A contact address for privacy questions will be added here before ede. opens to the public."
          )}{" "}
          If this policy changes in a way that matters, ede. will tell you in the app. See also the <Link href="/terms" className="text-foreground underline underline-offset-4">terms</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
