import { AppFrame } from "@/components/app-frame";

/** Every app screen shares the phone-width frame and tab bar. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppFrame>{children}</AppFrame>;
}
