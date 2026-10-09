import type { Metadata } from "next";
import { PlusScreen } from "@/components/game/plus-screen";
import { redirect } from "next/navigation";
import { plusEnabled } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zonkey Plus — $5 Lifetime Unlock",
  description: "Unlock Unlimited and the Daily Archive for $5 USD once. Daily stays free.",
  alternates: { canonical: "/plus" },
  robots: { index: false, follow: true },
};

export default function PlusPage() {
  if (!plusEnabled()) redirect("/");
  return <PlusScreen />;
}
