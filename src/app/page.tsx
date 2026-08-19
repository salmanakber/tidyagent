import { redirect } from "next/navigation";
import { Landing } from "@/components/marketing/Landing";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ instance?: string }>;
}) {
  const params = await searchParams;
  if (params.instance) {
    redirect(`/wix/open?instance=${encodeURIComponent(params.instance)}`);
  }

  return <Landing />;
}
