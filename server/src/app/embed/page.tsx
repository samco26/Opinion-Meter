import { Embed } from "@/components/Embed";

export const metadata = { title: "Opinion Meter" };

export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ key?: string; theme?: string; morph?: string; part?: string; view?: string }> }) {
  const { key = "", theme, morph, part, view } = await searchParams;
  return <Embed subjectKey={key.slice(0, 120)} dark={theme === "dark"} morph={morph === "1"} part={part === "opinions" ? "opinions" : undefined} start={view} />;
}
