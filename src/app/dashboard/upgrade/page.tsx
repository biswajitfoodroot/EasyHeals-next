import type { Metadata } from "next";
import UpgradeClient from "./UpgradeClient";

export const metadata: Metadata = {
  title: "Upgrade | EasyHeals",
  description: "Unlock AI-powered health tracking with EasyHeals Health+",
};

export default function UpgradePage() {
  return <UpgradeClient />;
}
