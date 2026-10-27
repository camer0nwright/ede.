"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMyData, updateAccount } from "@/app/(app)/you/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { safely } from "@/lib/safely";

type Account = { name: string; weightUnit: "kg" | "lb"; distanceUnit: "km" | "mi" };

/** Two options side by side; the chosen one is raised. */
function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="inline-flex rounded-xl bg-secondary p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors", value === o.value ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground")}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}

/** Name and units, saved as they change (the name when you tap Save). */
export function AccountSettings({ initial }: { initial: Account }) {
  const router = useRouter();
  const [account, setAccount] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const save = (next: Account, message: string) => {
    setErrors([]);
    startTransition(async () => {
      const result = await safely(() => updateAccount(next));
      if (!result.ok) return setErrors(result.errors);
      setAccount(next);
      toast(message);
      router.refresh();
    });
  };

  return (
    <div className="divide-y">
      <form
        className="flex items-end gap-2 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          save({ ...account, name: name.trim() }, "Name saved");
        }}
      >
        <label className="flex-1 text-sm text-muted-foreground">
          What ede. calls you
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" className="mt-1.5" />
        </label>
        {name.trim() !== account.name && (
          <Button type="submit" variant="secondary" disabled={pending || !name.trim()} className="h-9 rounded-lg">
            {pending ? <Loader2 className="animate-spin" /> : "Save"}
          </Button>
        )}
      </form>
      <Toggle
        label="Weights"
        value={account.weightUnit}
        options={[
          { value: "kg", label: "kg" },
          { value: "lb", label: "lb" },
        ]}
        onChange={(weightUnit) => weightUnit !== account.weightUnit && save({ ...account, weightUnit }, `Weights now in ${weightUnit}`)}
      />
      <Toggle
        label="Distances"
        value={account.distanceUnit}
        options={[
          { value: "km", label: "km" },
          { value: "mi", label: "miles" },
        ]}
        onChange={(distanceUnit) =>
          distanceUnit !== account.distanceUnit && save({ ...account, distanceUnit }, `Distances and paces now in ${distanceUnit === "mi" ? "miles" : "km"}`)
        }
      />
      {errors.length > 0 && (
        <div className="pt-3">
          <Note tone="caution">{errors.join(" ")}</Note>
        </div>
      )}
    </div>
  );
}

/** "Delete my data": explains what goes, then deletes on a second, deliberate tap. */
export function DeleteMyData() {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      const result = await safely(() => deleteMyData());
      if (result && !result.ok) setErrors(result.errors);
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 pt-3 text-sm font-medium text-destructive">
        <Trash2 className="size-4" aria-hidden /> Delete my data
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-4 pb-8">
            <DrawerHeader className="px-0 text-left! md:text-left">
              <DrawerTitle className="text-2xl font-semibold">Delete your data?</DrawerTitle>
              <DrawerDescription>This can&apos;t be undone.</DrawerDescription>
            </DrawerHeader>
            <p className="text-sm">ede. will permanently delete everything it holds about you:</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>Your profile, goal and settings</li>
              <li>Your plan, its weeks and sessions</li>
              <li>Injuries and any logged training</li>
            </ul>
            {errors.length > 0 && (
              <div className="mt-3">
                <Note tone="caution">{errors.join(" ")}</Note>
              </div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-12 rounded-xl" onClick={() => setOpen(false)} disabled={pending}>
                Keep my data
              </Button>
              <Button className="h-12 rounded-xl bg-destructive text-white hover:bg-destructive/90" onClick={confirm} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : "Delete everything"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
