import { parseJobSearchResponse, type JobSearchRequest, type JobSearchResponse } from "@/lib/jobs";

const STORAGE_KEY = "recommended-jobs-cache";
const VERSION = 1;

export function recommendedCacheKey(request: JobSearchRequest): string {
  return JSON.stringify({ query: request.query.trim(), userBlockers: [...request.userBlockers].sort() });
}

export function loadRecommendedCache(request: JobSearchRequest): JobSearchResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== VERSION || data.key !== recommendedCacheKey(request)) return null;
    return parseJobSearchResponse(data.response);
  } catch {
    return null;
  }
}

export function saveRecommendedCache(request: JobSearchRequest, response: JobSearchResponse): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, key: recommendedCacheKey(request), response }));
    return true;
  } catch {
    return false;
  }
}
