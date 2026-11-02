import type { Metadata } from "next";
import { SealPanel } from "@/components/employers/seal-panel";

export const metadata: Metadata = { title: "Seal" };

export default function SealPage() {
  return <SealPanel />;
}
