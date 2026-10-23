import type { Metadata } from "next";
import { AccountScreen } from "@/components/game/account-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Zonkey Account — Save Scores and Streaks Free",
  description: "Sign in with your email for free to keep your Zonkey scores and Daily streak on every device.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: true },
};

export default function AccountPage() {
  return <AccountScreen />;
}
