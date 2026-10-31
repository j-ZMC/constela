import { redirect } from "next/navigation";

// Recommended now lives on the Jobs page as "For you"; old links still work.
export default function RecommendedPage() {
  redirect("/jobs");
}
