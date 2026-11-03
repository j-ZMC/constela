// What a job's posting asks for in experience. Shared by the server (src/lib/job-posting.ts, which uses Node APIs)
// and the browser (saved jobs), so it lives apart from both.
import { z } from "zod";

export const postingSummary = z.object({
  required: z.array(z.string().min(1).max(300)).max(8),
  nice: z.array(z.string().min(1).max(300)).max(6),
  // "page": read from the job's own page; "saved": from the text Constela had, because the page could not be read.
  from: z.enum(["page", "saved"]),
  at: z.string(),
});
export type PostingSummary = z.infer<typeof postingSummary>;
