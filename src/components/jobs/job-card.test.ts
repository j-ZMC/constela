import { describe, expect, it } from "vitest";
import { jobDetails } from "@/components/jobs/job-card";
import type { Job } from "@/lib/jobs";

const job = (location: string, modality_classification: Job["modality_classification"], modality = "") =>
  ({ location, modality_classification, modality }) as Job;

describe("jobDetails", () => {
  it("shows location and work mode", () => {
    expect(jobDetails(job("Austin, Texas", "on_site"))).toEqual(["Austin, Texas", "On-site"]);
  });

  it("uses a mode written in the location as the work mode", () => {
    expect(jobDetails(job("Hybrid", "unknown"))).toEqual(["Hybrid"]);
  });

  it("never repeats the same word", () => {
    expect(jobDetails(job("Remote", "remote"))).toEqual(["Remote"]);
  });
});
