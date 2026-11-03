import { redirect } from "next/navigation";

// Recommended jobs now live in the Jobs tab of Jobs ("Jobs for you"); this keeps old links working.
export default function RecommendedPage() {
  redirect("/jobs");
}
