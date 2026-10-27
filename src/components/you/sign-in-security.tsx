"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePassword, logOutOtherDevices } from "@/app/(flow)/signup/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { safely } from "@/lib/safely";

const row = "flex w-full items-center justify-between py-3 text-left text-sm font-medium";

/** Change password, and log out the account's other devices (SPEC decision 58). */
export function SignInSecurity({ otherDevices }: { otherDevices: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setCurrent("");
      setNext("");
      setErrors([]);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    startTransition(async () => {
      const result = await safely(() => changePassword({ current, next }));
      if (!result.ok) return setErrors(result.errors);
      close(false);
      toast(result.message);
      router.refresh();
    });
  };

  const others = () =>
    startTransition(async () => {
      const result = await safely(() => logOutOtherDevices());
      toast(result.ok ? result.message : result.errors.join(" "));
      router.refresh();
    });

  return (
    <>
      <button type="button" className={row} onClick={() => setOpen(true)}>
        Change password <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {otherDevices > 0 && (
        <button type="button" className={row} onClick={others} disabled={pending}>
          <span>
            Log out other devices
            <span className="block text-xs font-normal text-muted-foreground">
              Logged in on {otherDevices} other {otherDevices === 1 ? "device" : "devices"}
            </span>
          </span>
          {pending && !open ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
        </button>
      )}

      <Drawer open={open} onOpenChange={close}>
        <DrawerContent>
          <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-8">
            <DrawerHeader className="px-0 text-left! md:text-left">
              <DrawerTitle className="text-[28px] leading-tight font-medium tracking-tight">Change password</DrawerTitle>
              <DrawerDescription>Other devices are logged out, so only you can get in with the new one.</DrawerDescription>
            </DrawerHeader>
            <label className="text-sm font-medium">
              Current password
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required className="mt-1.5 h-11" />
            </label>
            <label className="text-sm font-medium">
              New password
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required className="mt-1.5 h-11" />
              <span className="mt-1.5 block text-xs font-normal text-muted-foreground">At least 8 characters.</span>
            </label>
            {errors.length > 0 && <Note tone="caution">{errors.join(" ")}</Note>}
            <Button type="submit" size="lg" className="mt-2 h-12 w-full rounded-xl text-base font-semibold" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : "Change password"}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
