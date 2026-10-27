/**
 * Full-screen flows (setup, log in, sign-up, workouts, editing) with their own
 * buttons at the bottom: the phone-width column with no sidebar or tab bar.
 */
export default function FlowLayout({ children }: LayoutProps<"/">) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-24">{children}</div>;
}
