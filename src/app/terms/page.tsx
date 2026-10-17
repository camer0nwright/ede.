import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { LEGAL_UPDATED, MIN_AGE } from "@/lib/legal";

export const metadata = { title: "Terms · ede." };

/** Terms of use (SPEC decision 57), in plain English. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated={LEGAL_UPDATED}
      intro={<p>The rules for using ede. By creating an account you agree to them, and to how ede. handles your data in the privacy policy.</p>}
    >
      <LegalSection title="Not medical advice">
        <p>
          ede. gives general training guidance. It isn&apos;t a doctor, physio or coach who knows you, and it can&apos;t see how you&apos;re moving or feeling.
          <strong> Stop and get advice from a professional if you have pain, dizziness, chest pain or an injury</strong>, and check with a doctor before starting if
          you have a health condition. You choose what you do in each session and train at your own risk.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>You need to be {MIN_AGE} or over.</li>
          <li>Give honest answers: your plan is only as good as what you tell ede.</li>
          <li>Keep your password to yourself. You&apos;re responsible for what happens in your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          What you put into ede. stays yours. You let ede. store and use it to run the service, as the{" "}
          <Link href="/privacy" className="text-foreground underline underline-offset-4">
            privacy policy
          </Link>{" "}
          explains. You can download or delete it at any time from the You page.
        </p>
      </LegalSection>

      <LegalSection title="Fair use">
        <p>
          Don&apos;t try to get into other people&apos;s accounts, break or overload ede., copy it with automated tools, or use it for anything unlawful. Accounts that
          do may be suspended.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          ede. is free while it&apos;s being tested. It&apos;s provided as it is: plans are worked out by software and may sometimes be wrong, and features may change.
          If ede. ever closes or starts charging, you&apos;ll be told in good time and can download your data first.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          Nothing here limits liability for death or personal injury caused by negligence, for fraud, or anything else the law doesn&apos;t allow to be limited.
          Otherwise, ede. isn&apos;t responsible for losses that weren&apos;t foreseeable, or that come from not following the advice above.
        </p>
      </LegalSection>

      <LegalSection title="Ending">
        <p>You can stop using ede. and delete your data whenever you like. If these terms change in a way that matters, ede. will tell you in the app first.</p>
      </LegalSection>

      <LegalSection title="Law">
        <p>These terms are governed by the law of England and Wales. If you live elsewhere in the UK, you can also bring a claim where you live.</p>
      </LegalSection>
    </LegalPage>
  );
}
