import { redirect } from "next/navigation";

// Force dynamic rendering - never cache this page
export const dynamic = "force-dynamic";

export default function RootPage() {
  // 302 redirect to /app — browsers never cache redirects
  // This ensures the user always gets fresh content, even if they had
  // the old / page cached for a year
  redirect("/app");
}
