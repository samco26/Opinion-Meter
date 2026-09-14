import { Embed } from "@/components/Embed";

export const metadata = { title: "Opinion Meter" };

export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key = "" } = await searchParams;
  return <Embed subjectKey={key.slice(0, 120)} />;
}
