import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionEditor } from "@/components/you/section-editor";
import { athleteToDraft, isSection, SECTIONS } from "@/components/onboarding/draft";
import { getPlanContext, getSavedAthlete } from "@/server/athlete";

export async function generateMetadata({ params }: PageProps<"/you/edit/[section]">) {
  const { section } = await params;
  return { title: `${isSection(section) ? SECTIONS[section].title : "Edit"} · ede.` };
}

export default function EditSectionPage({ params }: PageProps<"/you/edit/[section]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/you/edit/[section]">["params"] }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const [loaded, ctx] = await Promise.all([getSavedAthlete(), getPlanContext()]);
  if (!loaded) redirect("/you");
  return <SectionEditor section={section} initial={athleteToDraft(loaded.saved)} started={ctx.today >= ctx.input.startDate} />;
}
