"""Bulk collector: all working sources in one run.

MX-first: computrabajo, occ, bumeran (rich descriptions, paged),
getonboard (18 categories, no-tech included). Remote: remotive,
remoteok, dice, workingnomads, wwr, arbeitnow, greenhouse, yc, torre.
Weak sources (empleo-gob, linkedin-guest) kept but off by default.
Talenteca REMOVED (poor descriptions, not useful for NLP).
Each source has a time budget (default 5 min). Paginates each API until
--limit per source. Dedupes by URL across all sources.

Usage:
  python collect_bulk.py --limit 300 --out data/raw/jobs/jobs_mx.json --query "ventas,atencion a clientes,auxiliar" --sources computrabajo,occ,bumeran,getonboard
"""
from __future__ import annotations

import argparse
import concurrent.futures
import html as html_lib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NLP_Astralis/0.1"
}
TIMEOUT = 25

BULK_SOURCES = ("computrabajo", "occ", "bumeran", "getonboard",
                "remotive", "remoteok", "dice", "yc", "torre",
                "workingnomads", "wwr", "arbeitnow", "greenhouse",
                "lever", "ashby", "usajobs", "ziprss",
                "linkedin", "empleo-gob")
MX_SOURCES = ("computrabajo", "occ", "bumeran")
PAGE_PAUSE = 2
SAVE_EVERY = 10
DICE_API_KEY = os.environ.get("DICE_API_KEY", "")
GREENHOUSE_BOARDS = ["stripe", "coinbase", "gitlab", "figma", "anthropic",
                     "duolingo", "reddit", "discord", "dropbox", "asana",
                     "intercom", "airbnb", "datadog", "cloudflare", "twilio",
                     "mongodb", "elastic", "lyft", "pinterest", "instacart",
                     "robinhood", "chime", "brex", "ramp", "vercel",
                     "databricks", "neo4j", "fivetran", "cortex", "comet",
                     "galileo", "coreweave", "nebius", "xai"]
LEVER_BOARDS = ["spotify"]
ASHBY_BOARDS = ["ashby", "anthropic", "openai", "linear", "vercel",
                "figma", "notion", "ramp", "brex", "deel",
                "remote", "arc", "scale", "databricks", "cohere",
                "perplexity", "runway", "replicate", "modal", "together",
                "groq", "cerebras", "fireworks", "anyscale", "baseten",
                "hex", "dbt", "fivetran", "airbyte", "prefect",
                "dagster", "weights", "wandb", "langchain", "qdrant",
                "clickhouse", "temporal", "neon", "planetscale", "supabase"]
ZIP_DEFAULT_QUERIES = ["software", "engineer", "nurse", "sales", "marketing",
                       "customer service", "accounting", "analyst"]
WWR_FEEDS = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-design-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
    "https://weworkremotely.com/categories/remote-sales-marketing-jobs.rss",
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def clean_html(raw_html: str) -> str:
    text = str(raw_html)
    for _ in range(2):
        text = html_lib.unescape(text)
        text = re.sub(r"<script.*?</script>", " ", text, flags=re.S | re.I)
        text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize(job: dict) -> dict:
    return {
        "title": job.get("title", ""),
        "company": job.get("company", ""),
        "location": job.get("location", ""),
        "modality": job.get("modality", ""),
        "salary_min": job.get("salary_min"),
        "salary_max": job.get("salary_max"),
        "currency": job.get("currency", ""),
        "description": clean_html(str(job.get("description", "") or ""))[:4000],
        "url": job.get("url", ""),
        "date": job.get("date", ""),
        "source": job.get("source", ""),
        "tags": job.get("tags", []),
    }


def append_job(path: str, job: dict) -> None:
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(job, ensure_ascii=False) + "\n")


def save_json(path: str, jobs: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(jobs, fh, ensure_ascii=False, indent=2)


def post_json(url: str, payload: dict, extra_headers: dict | None = None) -> dict:
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", **HEADERS, **(extra_headers or {})}
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8", errors="ignore"))


def split_queries(query: str) -> list[str]:
    parts = [q.strip() for q in (query or "").split(",")]
    return [q for q in parts if q]


SEEN_URLS: set = set()


def add_job(out: str, all_jobs: list[dict], item: dict) -> bool:
    url = (item.get("url", "") or "").strip()
    if url and url in SEEN_URLS:
        return False
    if url:
        SEEN_URLS.add(url)
    all_jobs.append(item)
    if len(all_jobs) % SAVE_EVERY == 0:
        save_json(out, all_jobs)
    return True


def collect_remoteok(limit: int, query: str, pause: float, out: str,
                     all_jobs: list[dict]) -> int:
    queries = split_queries(query) or [""]
    count = 0
    for q in queries:
        if count >= limit:
            break
        tag = f"?tag={urllib.parse.quote(q)}" if q else ""
        print(f"  [remoteok:{q or 'all'}] fetching...", flush=True)
        try:
            raw = fetch(f"https://remoteok.com/api{tag}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [remoteok:{q or 'all'}] ERROR: {exc}", file=sys.stderr)
            continue
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        jobs = [d for d in data if isinstance(d, dict) and d.get("position")]
        new_here = 0
        for job in jobs:
            if count >= limit:
                break
            ok = add_job(out, all_jobs, normalize({
                "title": job.get("position", ""),
                "company": job.get("company", ""),
                "location": job.get("location", "") or "Remote",
                "modality": "remote",
                "salary_min": job.get("salary_min") or None,
                "salary_max": job.get("salary_max") or None,
                "currency": "USD" if job.get("salary_min") else "",
                "description": clean_html(job.get("description", "")),
                "url": job.get("url") or f"https://remoteok.com/{job.get('slug', '')}",
                "date": job.get("date", ""),
                "source": "remoteok",
                "tags": job.get("tags", []),
            }))
            if ok:
                count += 1
                new_here += 1
        print(f"  [remoteok:{q or 'all'}] +{new_here} new", flush=True)
        save_json(out, all_jobs)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


DICE_DETAIL_RE = re.compile(
    r'job-detail-description-module__\w*__jobDescription">(.*?)</div>\s*</div>',
    re.S)
DICE_SKILLS_RE = re.compile(r'skillsList[^>]*>(.*?)</ul>', re.S)


def fetch_dice_detail(url: str) -> tuple[str, list[str]]:
    try:
        raw = fetch(url)
    except Exception:
        return "", []
    h = raw.decode("utf-8", errors="replace")
    desc = ""
    match = DICE_DETAIL_RE.search(h)
    if match:
        desc = clean_html(match.group(1))
    else:
        fallback = re.search(
            r'<div[^>]*jobDescription[^>]*>(.*?)</div>\s*</div>', h, re.S | re.I)
        if fallback:
            desc = clean_html(fallback.group(1))
    skills: list[str] = []
    smatch = DICE_SKILLS_RE.search(h)
    if smatch:
        skills = [clean_html(s) for s in
                  re.findall(r"<li[^>]*>(.*?)</li>", smatch.group(1), re.S)][:20]
        skills = [s for s in skills if s]
    return desc[:4000], skills


def collect_dice(limit: int, query: str, pause: float, out: str,
                 all_jobs: list[dict], with_details: bool = True,
                 max_details: int = 0) -> int:
    queries = split_queries(query) or ["python"]
    seen_urls: set = set()
    collected = 0
    fields = "jobId|title|companyName|jobLocation.displayName|detailsPageUrl|postedDate|salary"
    for qi, q in enumerate(queries):
        if collected >= limit:
            break
        page = 1
        while collected < limit:
            per_page = min(50, limit - collected)
            qs = urllib.parse.urlencode({
                "q": q, "page": str(page), "pageSize": str(per_page),
                "fields": fields, "culture": "en"})
            req = urllib.request.Request(
                "https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?" + qs,
                headers={**HEADERS, "Accept": "application/json",
                         "x-api-key": DICE_API_KEY, "Origin": "https://www.dice.com"})
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                    data = json.loads(resp.read().decode("utf-8", errors="ignore"))
            except Exception as exc:  # noqa: BLE001
                print(f"  [dice:{q}] page {page} ERROR: {exc}, waiting 10s...",
                      file=sys.stderr)
                time.sleep(10)
                continue
            jobs = data.get("data", [])
            if not jobs:
                print(f"  [dice:{q}] no more pages")
                break
            details_fetched = 0
            for job in jobs:
                url = job.get("detailsPageUrl", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                loc = job.get("jobLocation", {}) or {}
                desc = (job.get("salary", "") or "")
                skills: list[str] = []
                if with_details and (max_details <= 0 or details_fetched < max_details):
                    try:
                        desc, skills = fetch_dice_detail(url)
                    except Exception:
                        pass
                    details_fetched += 1
                    time.sleep(min(pause, 1.0))
                    if details_fetched % 10 == 0:
                        save_json(out, all_jobs)
                ok = add_job(out, all_jobs, normalize({
                    "title": job.get("title", ""),
                    "company": job.get("companyName", ""),
                    "location": loc.get("displayName", ""),
                    "modality": "",
                    "salary_min": None,
                    "salary_max": None,
                    "currency": "USD",
                    "description": desc or (job.get("salary", "") or ""),
                    "url": job.get("detailsPageUrl", ""),
                    "date": job.get("postedDate", ""),
                    "source": "dice",
                    "tags": skills,
                }))
                if ok:
                    collected += 1
                if len(all_jobs) % SAVE_EVERY == 0:
                    save_json(out, all_jobs)
                if collected >= limit:
                    break
            print(f"  [dice:{q}] page {page}: {collected}/{limit}", flush=True)
            save_json(out, all_jobs)
            page += 1
            time.sleep(pause)
    save_json(out, all_jobs)
    return collected


def collect_yc(limit: int, out: str, all_jobs: list[dict]) -> int:
    print("  [yc] fetching yc-oss dataset + seed page...", flush=True)
    count = 0
    try:
        raw = fetch("https://yc-oss.github.io/api/tags/ai.json")
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        companies = data if isinstance(data, list) else data.get("companies", [])
    except Exception as exc:  # noqa: BLE001
        print(f"  [yc] yc-oss ERROR: {exc}", file=sys.stderr)
        companies = []
    for comp in companies:
        if count >= limit:
            break
        slug = (comp.get("slug", "") or comp.get("name", "")).strip()
        if not slug:
            continue
        for board_t, base in (("greenhouse", "https://boards.greenhouse.io/v1/boards/"),
                              ("lever", "https://api.lever.co/v0/postings/"),
                              ("ashby", "https://api.ashbyhq.com/posting-api/job-board/")):
            if count >= limit:
                break
            try:
                rraw = fetch(f"{base}{slug}/jobs" if board_t == "greenhouse"
                             else f"{base}{slug}")
            except Exception:
                continue
            try:
                rdata = json.loads(rraw.decode("utf-8", errors="ignore"))
            except Exception:
                continue
            rjobs = (rdata.get("jobs", []) if isinstance(rdata, dict)
                     else rdata if isinstance(rdata, list) else [])
            for job in rjobs:
                if count >= limit:
                    break
                if board_t == "greenhouse":
                    loc = (job.get("location") or {}).get("name", "") if isinstance(job.get("location"), dict) else ""
                    ok = add_job(out, all_jobs, normalize({
                        "title": job.get("title", ""),
                        "company": slug,
                        "location": loc,
                        "modality": "",
                        "salary_min": None,
                        "salary_max": None,
                        "currency": "",
                        "description": clean_html(job.get("content", "")),
                        "url": job.get("absolute_url", ""),
                        "date": "",
                        "source": "yc",
                        "tags": [],
                    }))
                elif board_t == "lever":
                    cats = job.get("categories", {}) or {}
                    ok = add_job(out, all_jobs, normalize({
                        "title": job.get("text", ""),
                        "company": slug,
                        "location": cats.get("location", ""),
                        "modality": "",
                        "salary_min": None,
                        "salary_max": None,
                        "currency": "",
                        "description": clean_html(job.get("description", "")),
                        "url": job.get("hostedUrl", ""),
                        "date": "",
                        "source": "yc",
                        "tags": [],
                    }))
                else:
                    ok = add_job(out, all_jobs, normalize({
                        "title": job.get("title", ""),
                        "company": slug,
                        "location": job.get("location", "") or "",
                        "modality": "",
                        "salary_min": None,
                        "salary_max": None,
                        "currency": "",
                        "description": clean_html(job.get("descriptionHtml", "")),
                        "url": job.get("jobUrl", ""),
                        "date": "",
                        "source": "yc",
                        "tags": [],
                    }))
                if ok:
                    count += 1
            if rjobs:
                print(f"  [yc:{slug}] resolved via {board_t}", flush=True)
                save_json(out, all_jobs)
                break
        time.sleep(0.5)
    if count < limit:
        try:
            raw = fetch("https://www.ycombinator.com/jobs")
        except Exception as exc:  # noqa: BLE001
            print(f"  [yc] seed ERROR: {exc}", file=sys.stderr)
            save_json(out, all_jobs)
            return count
        home = raw.decode("utf-8", errors="ignore")
        urls = sorted(set(re.findall(r'"/companies/[^"]*?/jobs/[^"]*?"', home)))
        for item in urls:
            if count >= limit:
                break
            path = item.strip('"')
            ok = add_job(out, all_jobs, normalize({
                "title": path.split("/jobs/")[-1].replace("-", " "),
                "company": path.split("/companies/")[-1].split("/jobs/")[0].replace("-", " "),
                "location": "USA / Remote",
                "modality": "",
                "salary_min": None,
                "salary_max": None,
                "currency": "USD",
                "description": "",
                "url": "https://www.ycombinator.com" + path,
                "date": "",
                "source": "yc",
                "tags": [],
            }))
            if ok:
                count += 1
    save_json(out, all_jobs)
    print(f"  [yc] +{count} new", flush=True)
    return count


def collect_torre(limit: int, query: str, out: str,
                  all_jobs: list[dict]) -> int:
    queries = split_queries(query) or ["python"]
    seen_torre: set = set()
    count = 0
    for q in queries:
        if count >= limit:
            break
        print(f"  [torre:{q}] fetching...", flush=True)
        size = min(50, limit - count)
        try:
            data = post_json(
                f"https://search.torre.co/opportunities/_search/?size={size}&offset=0",
                {"and": [{"skill/role": {"text": q, "experience": "potential-to-develop"}}]},
                {"User-Agent": "torre-cli (+https://github.com/jjuanrivvera/torre-cli)"})
        except Exception as exc:  # noqa: BLE001
            print(f"  [torre:{q}] ERROR: {exc}", file=sys.stderr)
            continue
        for result in data.get("results", []):
            if count >= limit:
                break
            rid = result.get("id", "")
            if rid in seen_torre:
                continue
            seen_torre.add(rid)
            orgs = result.get("organizations", [])
        company = orgs[0].get("name", "") if orgs else ""
        locations = [loc for loc in (result.get("locations") or []) if isinstance(loc, str)]
        comp = result.get("compensation", {}) or {}
        skills = [s.get("name", "") for s in (result.get("skills") or []) if isinstance(s, dict)]
        all_jobs.append(normalize({
            "title": result.get("objective", ""),
            "company": company,
            "location": ", ".join(locations) or ("Remote" if result.get("remote") else ""),
            "modality": "remote" if result.get("remote") else "",
            "salary_min": comp.get("minAmount") if isinstance(comp, dict) else None,
            "salary_max": comp.get("maxAmount") if isinstance(comp, dict) else None,
            "currency": comp.get("currency", "") if isinstance(comp, dict) else "",
            "description": clean_html(result.get("tagline", "")),
            "url": f"https://torre.ai/jobs/{result.get('id', '')}" if result.get("id") else "",
            "date": result.get("created", ""),
            "source": "torre",
            "tags": skills[:10],
        }))
        count += 1
        if len(all_jobs) % SAVE_EVERY == 0:
            save_json(out, all_jobs)
    save_json(out, all_jobs)
    return count


def collect_workingnomads(limit: int, pause: float, out: str,
                          all_jobs: list[dict]) -> int:
    print("  [workingnomads] fetching...", flush=True)
    try:
        raw = fetch("https://www.workingnomads.com/api/jobs")
    except Exception as exc:  # noqa: BLE001
        print(f"  [workingnomads] ERROR: {exc}", file=sys.stderr)
        return 0
    data = json.loads(raw.decode("utf-8", errors="ignore"))
    jobs = data if isinstance(data, list) else data.get("jobs", [])
    count = 0
    for job in jobs[:limit]:
        loc = job.get("location", "") or ""
        if isinstance(loc, list):
            loc = ", ".join(loc)
        ok = add_job(out, all_jobs, normalize({
            "title": job.get("title", "") or job.get("position", ""),
            "company": job.get("company", "") or job.get("company_name", ""),
            "location": loc or "Remote",
            "modality": "remote",
            "salary_min": None,
            "salary_max": None,
            "currency": "",
            "description": clean_html(job.get("description", "")),
            "url": job.get("url", "") or job.get("link", ""),
            "date": job.get("pub_date", "") or job.get("date", ""),
            "source": "workingnomads",
            "tags": job.get("tags", []) if isinstance(job.get("tags"), list) else [],
        }))
        if ok:
            count += 1
    save_json(out, all_jobs)
    print(f"  [workingnomads] +{count} new", flush=True)
    time.sleep(pause)
    return count


def collect_wwr(limit: int, pause: float, out: str,
                all_jobs: list[dict]) -> int:
    import xml.etree.ElementTree as ET
    count = 0
    for feed in WWR_FEEDS:
        if count >= limit:
            break
        try:
            raw = fetch(feed)
        except Exception as exc:  # noqa: BLE001
            print(f"  [wwr] {feed} ERROR: {exc}", file=sys.stderr)
            continue
        try:
            root = ET.fromstring(raw)
        except Exception as exc:  # noqa: BLE001
            print(f"  [wwr] {feed} XML ERROR: {exc}", file=sys.stderr)
            continue
        for item in root.iter("item"):
            if count >= limit:
                break
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = clean_html(item.findtext("description") or "")
            pub = (item.findtext("pubDate") or "").strip()
            ok = add_job(out, all_jobs, normalize({
                "title": title,
                "company": "",
                "location": "Remote",
                "modality": "remote",
                "salary_min": None,
                "salary_max": None,
                "currency": "",
                "description": desc,
                "url": link,
                "date": pub,
                "source": "wwr",
                "tags": [],
            }))
            if ok:
                count += 1
        print(f"  [wwr] {feed.split('/')[-1]} total={count}", flush=True)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_arbeitnow(limit: int, pause: float, out: str,
                      all_jobs: list[dict]) -> int:
    count = 0
    page = 1
    while count < limit:
        try:
            raw = fetch(f"https://www.arbeitnow.com/api/job-board-api?page={page}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [arbeitnow] page {page} ERROR: {exc}", file=sys.stderr)
            break
        try:
            data = json.loads(raw.decode("utf-8", errors="ignore"))
        except Exception as exc:  # noqa: BLE001
            print(f"  [arbeitnow] page {page} JSON ERROR: {exc}", file=sys.stderr)
            break
        jobs = data.get("data", [])
        if not jobs:
            print("  [arbeitnow] no more pages")
            break
        for job in jobs:
            if count >= limit:
                break
            loc = job.get("location", "") or ""
            ok = add_job(out, all_jobs, normalize({
                "title": job.get("title", ""),
                "company": job.get("company_name", "") or job.get("company", ""),
                "location": loc or "Remote",
                "modality": "remote" if job.get("remote", False) else "",
                "salary_min": None,
                "salary_max": None,
                "currency": "",
                "description": clean_html(job.get("description", "")),
                "url": job.get("url", "") or job.get("slug", ""),
                "date": job.get("created_at", ""),
                "source": "arbeitnow",
                "tags": job.get("tags", []) if isinstance(job.get("tags"), list) else [],
            }))
            if ok:
                count += 1
        print(f"  [arbeitnow] page {page}: {count}/{limit}", flush=True)
        save_json(out, all_jobs)
        if not data.get("links", {}).get("next"):
            break
        page += 1
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_greenhouse(limit: int, pause: float, out: str,
                       all_jobs: list[dict], boards: list[str]) -> int:
    count = 0
    per_board = max(1, limit // max(1, len(boards)))
    for board in boards:
        if count >= limit:
            break
        try:
            raw = fetch(f"https://boards.greenhouse.io/v1/boards/{board}/jobs?content=true")
        except Exception as exc:  # noqa: BLE001
            print(f"  [greenhouse:{board}] ERROR: {exc}", file=sys.stderr)
            continue
        try:
            data = json.loads(raw.decode("utf-8", errors="ignore"))
        except Exception as exc:  # noqa: BLE001
            print(f"  [greenhouse:{board}] JSON ERROR: {exc}", file=sys.stderr)
            continue
        new_here = 0
        for job in data.get("jobs", [])[:per_board]:
            if count >= limit:
                break
            loc = (job.get("location") or {}).get("name", "") if isinstance(job.get("location"), dict) else ""
            depts = [d.get("name", "") for d in (job.get("departments") or []) if isinstance(d, dict)]
            ok = add_job(out, all_jobs, normalize({
                "title": job.get("title", ""),
                "company": board,
                "location": loc,
                "modality": "",
                "salary_min": None,
                "salary_max": None,
                "currency": "",
                "description": clean_html(job.get("content", "")),
                "url": job.get("absolute_url", ""),
                "date": "",
                "source": "greenhouse",
                "tags": depts,
            }))
            if ok:
                count += 1
                new_here += 1
        print(f"  [greenhouse:{board}] +{new_here} new", flush=True)
        save_json(out, all_jobs)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_lever(limit: int, pause: float, out: str,
                  all_jobs: list[dict], boards: list[str]) -> int:
    count = 0
    per_board = max(1, limit // max(1, len(boards)))
    for board in boards:
        if count >= limit:
            break
        try:
            raw = fetch(f"https://api.lever.co/v0/postings/{board}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [lever:{board}] ERROR: {exc}", file=sys.stderr)
            continue
        try:
            data = json.loads(raw.decode("utf-8", errors="ignore"))
        except Exception as exc:  # noqa: BLE001
            print(f"  [lever:{board}] JSON ERROR: {exc}", file=sys.stderr)
            continue
        jobs = data if isinstance(data, list) else []
        new_here = 0
        for job in jobs[:per_board]:
            if count >= limit:
                break
            cats = job.get("categories", {}) or {}
            ok = add_job(out, all_jobs, normalize({
                "title": job.get("text", ""),
                "company": board,
                "location": cats.get("location", ""),
                "modality": "",
                "salary_min": None,
                "salary_max": None,
                "currency": "",
                "description": clean_html(job.get("description", "")),
                "url": job.get("hostedUrl", ""),
                "date": job.get("createdAt", ""),
                "source": "lever",
                "tags": [cats.get("team", "")] if cats.get("team") else [],
            }))
            if ok:
                count += 1
                new_here += 1
        print(f"  [lever:{board}] +{new_here} new", flush=True)
        save_json(out, all_jobs)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_ashby(limit: int, pause: float, out: str,
                  all_jobs: list[dict], boards: list[str]) -> int:
    count = 0
    per_board = max(1, limit // max(1, len(boards)))
    for board in boards:
        if count >= limit:
            break
        try:
            raw = fetch(f"https://api.ashbyhq.com/posting-api/job-board/{board}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [ashby:{board}] ERROR: {exc}", file=sys.stderr)
            continue
        try:
            data = json.loads(raw.decode("utf-8", errors="ignore"))
        except Exception as exc:  # noqa: BLE001
            print(f"  [ashby:{board}] JSON ERROR: {exc}", file=sys.stderr)
            continue
        new_here = 0
        for job in (data.get("jobs", []) or [])[:per_board]:
            if count >= limit:
                break
            ok = add_job(out, all_jobs, normalize({
                "title": job.get("title", ""),
                "company": board,
                "location": job.get("location", "") or "",
                "modality": "remote" if "remote" in (job.get("location", "") or "").lower() else "",
                "salary_min": None,
                "salary_max": None,
                "currency": "",
                "description": clean_html(job.get("descriptionHtml", "")
                                          or job.get("descriptionPlain", "")),
                "url": job.get("jobUrl", ""),
                "date": "",
                "source": "ashby",
                "tags": [job.get("department", "")] if job.get("department") else [],
            }))
            if ok:
                count += 1
                new_here += 1
        print(f"  [ashby:{board}] +{new_here} new", flush=True)
        save_json(out, all_jobs)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_ziprss(limit: int, query: str, pause: float, out: str,
                   all_jobs: list[dict]) -> int:
    import xml.etree.ElementTree as ET
    queries = split_queries(query) or ZIP_DEFAULT_QUERIES
    count = 0
    for q in queries:
        if count >= limit:
            break
        url = ("https://www.ziprecruiter.com/candidate/search?search="
               + urllib.parse.quote(q) + "&location=United+States&rss=1")
        try:
            raw = fetch(url)
        except Exception as exc:  # noqa: BLE001
            print(f"  [ziprss:{q}] ERROR: {exc}", file=sys.stderr)
            continue
        try:
            root = ET.fromstring(raw)
        except Exception as exc:  # noqa: BLE001
            print(f"  [ziprss:{q}] XML ERROR (likely Cloudflare): {exc}",
                  file=sys.stderr)
            continue
        new_here = 0
        for item in root.iter("item"):
            if count >= limit:
                break
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = clean_html(item.findtext("description") or "")
            pub = (item.findtext("pubDate") or "").strip()
            if not title:
                continue
            ok = add_job(out, all_jobs, normalize({
                "title": title,
                "company": "",
                "location": "USA",
                "modality": "",
                "salary_min": None,
                "salary_max": None,
                "currency": "USD",
                "description": desc[:4000],
                "url": link,
                "date": pub,
                "source": "ziprss",
                "tags": [],
            }))
            if ok:
                count += 1
                new_here += 1
        print(f"  [ziprss:{q}] +{new_here} new", flush=True)
        save_json(out, all_jobs)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_usajobs(limit: int, query: str, pause: float, out: str,
                    all_jobs: list[dict], api_key: str) -> int:
    if not api_key:
        print("  [usajobs] skipped: set --usajobs-key (free at usajobs.gov)", flush=True)
        return 0
    queries = split_queries(query) or ["information technology"]
    headers = {**HEADERS, "Authorization-Key": api_key,
               "User-Agent": "NLP_Astralis/0.1 (job research)",
               "Host": "data.usajobs.gov"}
    count = 0
    per_query = max(1, limit // max(1, len(queries)))
    for q in queries:
        if count >= limit:
            break
        page, per_page = 1, 50
        while count < limit:
            params = {"Keyword": q, "Page": page, "ResultsPerPage": per_page}
            req = urllib.request.Request(
                "https://data.usajobs.gov/api/search?" + urllib.parse.urlencode(params),
                headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                    data = json.loads(resp.read().decode("utf-8", errors="ignore"))
            except Exception as exc:  # noqa: BLE001
                print(f"  [usajobs:{q}] page {page} ERROR: {exc}", file=sys.stderr)
                break
            items = ((data.get("SearchResult") or {}).get("SearchResultItems")) or []
            if not items:
                print(f"  [usajobs:{q}] no more pages")
                break
            new_here = 0
            for item in items:
                if count >= per_query * (queries.index(q) + 1):
                    break
                desc = item.get("MatchedObjectDescriptor") or {}
                pos = desc.get("PositionLocation") or [{}]
                loc = pos[0].get("LocationName", "") if pos else ""
                pay = desc.get("PositionRemuneration") or [{}]
                pay0 = pay[0] if pay else {}
                area = desc.get("UserArea") or {}
                details = area.get("Details") or {}
                ok = add_job(out, all_jobs, normalize({
                    "title": desc.get("PositionTitle", ""),
                    "company": (desc.get("DepartmentName", "") or "US Government"),
                    "location": loc,
                    "modality": "",
                    "salary_min": pay0.get("MinimumRange"),
                    "salary_max": pay0.get("MaximumRange"),
                    "currency": "USD",
                    "description": clean_html(details.get("JobSummary", "")),
                    "url": desc.get("PositionURI", ""),
                    "date": desc.get("PublicationStartDate", ""),
                    "source": "usajobs",
                    "tags": [],
                }))
                if ok:
                    count += 1
                    new_here += 1
            print(f"  [usajobs:{q}] page {page}: +{new_here} (total {count}/{limit})",
                  flush=True)
            save_json(out, all_jobs)
            page += 1
            time.sleep(pause)
    save_json(out, all_jobs)
    return count


MX_MAX_PAGES = 25
MX_MAX_DETAILS = 300


def parse_mx_list(list_url: str, link_re: str, site: str, limit: int,
                  pause: float, out: str, all_jobs: list[dict],
                  max_details: int = MX_MAX_DETAILS) -> int:
    try:
        raw = fetch(list_url)
    except Exception as exc:  # noqa: BLE001
        print(f"  [{site}] list ERROR: {exc}", file=sys.stderr)
        return 0
    home = raw.decode("utf-8", errors="replace")
    links = sorted(set(re.findall(link_re, home, flags=re.I)))[:max(1, limit)]
    count = 0
    for href in links:
        url = href if href.startswith("http") else f"https://www.{site}.com.mx{href}"
        try:
            draw = fetch(url)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{site}] detail ERROR {url}: {exc}", file=sys.stderr)
            continue
        detail = draw.decode("utf-8", errors="replace")
        title_m = re.search(r"<h1[^>]*>(.*?)</h1>", detail, flags=re.S | re.I)
        title = clean_html(title_m.group(1)) if title_m else ""
        body_m = re.search(
            r'<div[^>]*(descripcion|description|oferta|detalle|vacante)[^>]*>(.*?)</div>',
            detail, flags=re.S | re.I)
        desc = clean_html(body_m.group(2)) if body_m else clean_html(detail)[:4000]
        sal = re.search(r"\$[\d,]+(?:\s*[-–a]\s*\$?[\d,]+)?(?:\s*(?:mensual|mensuales|MXN|pesos))?",
                        detail, flags=re.I)
        ok = add_job(out, all_jobs, normalize({
            "title": title,
            "company": "",
            "location": "Mexico",
            "modality": "",
            "salary_min": None,
            "salary_max": None,
            "currency": "MXN",
            "description": desc[:4000] + (f" | salary_hint: {sal.group(0)}" if sal else ""),
            "url": url,
            "date": "",
            "source": site,
            "tags": [],
        }))
        if ok:
            count += 1
        if count < limit and count % 5 == 0:
            save_json(out, all_jobs)
        time.sleep(pause)
    save_json(out, all_jobs)
    return count


def collect_mx_paged(base_url_fn, link_re: str, site: str, limit: int,
                   query: str, pause: float, out: str, all_jobs: list[dict],
                   max_pages: int, max_details: int) -> int:
    queries = split_queries(query) or [""]
    total = 0
    seen_links: set = set()
    details = 0
    for q in queries:
        if total >= limit:
            break
        for page in range(1, max_pages + 1):
            if total >= limit or details >= max_details:
                break
            list_url = base_url_fn(q, page)
            try:
                raw = fetch(list_url)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{site}:{q or 'all'}] list p{page} ERROR: {exc}",
                      file=sys.stderr)
                break
            home = raw.decode("utf-8", errors="replace")
            links = sorted(set(re.findall(link_re, home, flags=re.I)))
            fresh = [l for l in links if l not in seen_links]
            if not fresh:
                print(f"  [{site}:{q or 'all'}] p{page}: no new links, next query")
                break
            new_here = 0
            for href in fresh:
                if total >= limit or details >= max_details:
                    break
                seen_links.add(href)
                url = href if href.startswith("http") else f"https://www.{site}.com.mx{href}"
                details += 1
                try:
                    draw = fetch(url)
                except Exception:  # noqa: BLE001 - skip slow pages fast
                    continue
                d = draw.decode("utf-8", errors="replace")
                title_m = re.search(r"<h1[^>]*>(.*?)</h1>", d, flags=re.S | re.I)
                title = clean_html(title_m.group(1)) if title_m else ""
                body_m = re.search(
                    r'<div[^>]*(descripcion|description|oferta|detalle|vacante|requisito|funcion)[^>]*>(.*?)</div>',
                    d, flags=re.S | re.I)
                desc = clean_html(body_m.group(2)) if body_m else clean_html(d)[:4000]
                comp_m = re.search(
                    r'(?:empresa|company|compa[ñn][ií]a)[^<]{0,80}?[:>]\s*([^<]{2,80})',
                    d, flags=re.S | re.I)
                company = clean_html(comp_m.group(1)) if comp_m else ""
                loc_m = re.search(
                    r'(?:ubicaci[óo]n|location|ciudad|lugar)[^<]{0,80}?[:>]\s*([^<]{2,80})',
                    d, flags=re.S | re.I)
                location = clean_html(loc_m.group(1)) if loc_m else "Mexico"
                sal = re.search(
                    r"\$[\d,]+(?:\s*[-–a]\s*\$?[\d,]+)?(?:\s*(?:mensual|mensuales|MXN|pesos))?",
                    d, flags=re.I)
                if len(desc) < 100:
                    continue
                ok = add_job(out, all_jobs, normalize({
                    "title": title[:200],
                    "company": company[:120],
                    "location": location[:120],
                    "modality": "presencial",
                    "salary_min": None,
                    "salary_max": None,
                    "currency": "MXN",
                    "description": (desc[:4000] + (f" | salary_hint: {sal.group(0)}" if sal else "")),
                    "url": url,
                    "date": "",
                    "source": site,
                    "tags": [],
                }))
                if ok:
                    total += 1
                    new_here += 1
                    if len(all_jobs) % SAVE_EVERY == 0:
                        save_json(out, all_jobs)
                time.sleep(pause)
            print(f"  [{site}:{q or 'all'}] p{page}: +{new_here} (total {total}/{limit})",
                  flush=True)
            save_json(out, all_jobs)
            time.sleep(pause)
    return total


def collect_computrabajo(limit: int, query: str, pause: float, out: str,
                         all_jobs: list[dict]) -> int:
    print("  [computrabajo] paged scan...", flush=True)
    return collect_mx_paged(
        lambda q, p: ("https://www.computrabajo.com.mx/trabajo-de-"
                      + urllib.parse.quote((q or "empleos").replace(" ", "-"))
                      + f"?p={p}"),
        r'href="(/oferta-de-trabajo/[^"]+?)"',
        "computrabajo", limit, query, pause, out, all_jobs,
        MX_MAX_PAGES, MX_MAX_DETAILS)


def collect_bumeran(limit: int, query: str, pause: float, out: str,
                    all_jobs: list[dict]) -> int:
    print("  [bumeran] paged scan...", flush=True)
    return collect_mx_paged(
        lambda q, p: ("https://www.bumeran.com.mx/empleos-busqueda-"
                      + urllib.parse.quote((q or "empleos").replace(" ", "-"))
                      + (f"-pagina-{p}" if p > 1 else "") + ".html"),
        r'href="(/empleos/[^"]+?\.html)"',
        "bumeran", limit, query, pause, out, all_jobs,
        MX_MAX_PAGES, MX_MAX_DETAILS)


def collect_occ(limit: int, query: str, pause: float, out: str,
                all_jobs: list[dict]) -> int:
    print("  [occ] paged scan...", flush=True)
    return collect_mx_paged(
        lambda q, p: ("https://www.occ.com.mx/empleos/de-"
                      + urllib.parse.quote((q or "empleos").replace(" ", "-"))
                      + (f"/pagina-{p}" if p > 1 else "")),
        r'href="(/oferta/\d+[^"]*?)"',
        "occ", limit, query, pause, out, all_jobs,
        MX_MAX_PAGES, MX_MAX_DETAILS)


def collect_linkedin(limit: int, query: str, pause: float, out: str,
                     all_jobs: list[dict]) -> int:
    q = (split_queries(query) or ["python"])[0]
    print(f"  [linkedin:{q}] guest search...", flush=True)
    list_url = ("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
                "?keywords=" + urllib.parse.quote(q) + "&location=Mexico&start=0")
    try:
        raw = fetch(list_url)
    except Exception as exc:  # noqa: BLE001
        print(f"  [linkedin] ERROR: {exc}", file=sys.stderr)
        return 0
    cards = re.findall(
        r'data-entity-urn="urn:li:jobPosting:(\d+)"(.*?)</li>',
        raw.decode("utf-8", errors="replace"), flags=re.S)
    count = 0
    for job_id, card in cards[:limit]:
        title = re.search(r'class="base-search-card__title"[^>]*>(.*?)</',
                          card, flags=re.S)
        comp = re.search(r'class="base-search-card__subtitle"[^>]*>.*?<a[^>]*>(.*?)</a>',
                         card, flags=re.S)
        loc = re.search(r'class="job-search-card__location"[^>]*>(.*?)</',
                        card, flags=re.S)
        ok = add_job(out, all_jobs, normalize({
            "title": clean_html(title.group(1)) if title else "",
            "company": clean_html(comp.group(1)) if comp else "",
            "location": clean_html(loc.group(1)) if loc else "",
            "modality": "",
            "salary_min": None,
            "salary_max": None,
            "currency": "",
            "description": "",
            "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
            "date": "",
            "source": "linkedin",
            "tags": [],
        }))
        if ok:
            count += 1
        time.sleep(0.5)
    save_json(out, all_jobs)
    print(f"  [linkedin] +{count} new", flush=True)
    return count


def collect_empleo_gob(limit: int, query: str, pause: float, out: str,
                       all_jobs: list[dict]) -> int:
    print("  [empleo-gob] listing...", flush=True)
    q = (split_queries(query) or [""])[0]
    list_url = ("https://www.empleo.gob.mx/PortalEmpleo/VerOfertas"
                "?q=" + urllib.parse.quote(q))
    try:
        raw = fetch(list_url)
    except Exception as exc:  # noqa: BLE001
        print(f"  [empleo-gob] ERROR: {exc}", file=sys.stderr)
        return 0
    home = raw.decode("utf-8", errors="replace")
    links = sorted(set(re.findall(r'href="([^"]*?(?:oferta|vacante|detalle)[^"]*?)"',
                                  home, flags=re.I)))[:max(1, limit)]
    if not links:
        links = sorted(set(re.findall(r'href="(/[^"]*?)"', home, flags=re.I)))[:max(1, limit)]
    count = 0
    for href in links:
        if count >= limit:
            break
        url = href if href.startswith("http") else f"https://www.empleo.gob.mx{href}"
        if not url.startswith("http"):
            continue
        try:
            draw = fetch(url)
        except Exception:  # noqa: BLE001 - skip slow detail pages fast
            continue
        detail = draw.decode("utf-8", errors="replace")
        title_m = re.search(r"<h1[^>]*>(.*?)</h1>", detail, flags=re.S | re.I)
        title = clean_html(title_m.group(1)) if title_m else clean_html(href)
        body_m = re.search(
            r'<div[^>]*(descripcion|description|oferta|detalle|vacante|contenido)[^>]*>(.*?)</div>',
            detail, flags=re.S | re.I)
        desc = clean_html(body_m.group(2)) if body_m else ""
        if len(title) < 3 and len(desc) < 50:
            continue
        ok = add_job(out, all_jobs, normalize({
            "title": title[:200],
            "company": "",
            "location": "Mexico",
            "modality": "presencial",
            "salary_min": None,
            "salary_max": None,
            "currency": "MXN",
            "description": desc[:4000],
            "url": url,
            "date": "",
            "source": "empleo-gob",
            "tags": [],
        }))
        if ok:
            count += 1
            if count % SAVE_EVERY == 0:
                save_json(out, all_jobs)
        time.sleep(max(pause, 2.0))
    save_json(out, all_jobs)
    print(f"  [empleo-gob] +{count} new", flush=True)
    return count


def collect_remotive(limit: int, query: str, pause: float, out: str,
                     all_jobs: list[dict]) -> int:
    queries = split_queries(query)
    seen: set = set()
    collected = 0
    if not queries:
        queries = [""]
    for q in queries:
        if collected >= limit:
            break
        page = 1
        while collected < limit:
            params = {"limit": 50, "page": page}
            if q:
                params["search"] = q
            url = "https://remotive.com/api/remote-jobs?" + urllib.parse.urlencode(params)
            try:
                raw = fetch(url)
            except Exception as exc:  # noqa: BLE001 - retry next page cycle
                print(f"  [remotive:{q or 'all'}] page {page} ERROR: {exc}, waiting 10s...",
                      file=sys.stderr)
                time.sleep(10)
                continue
            data = json.loads(raw.decode("utf-8", errors="ignore"))
            jobs = data.get("jobs", [])
            if not jobs:
                print(f"  [remotive:{q or 'all'}] no more pages")
                break
            new_in_page = 0
            for job in jobs:
                if job.get("id") in seen:
                    continue
                seen.add(job.get("id"))
                new_in_page += 1
                item = normalize({
                    "title": job.get("title", ""),
                    "company": job.get("company_name", ""),
                    "location": job.get("candidate_required_location", ""),
                    "modality": "remote",
                    "salary_min": None,
                    "salary_max": None,
                    "currency": "",
                    "description": clean_html(job.get("description", "")),
                    "url": job.get("url", ""),
                    "date": job.get("publication_date", ""),
                    "source": "remotive",
                    "tags": job.get("tags", []),
                })
                all_jobs.append(item)
                collected += 1
                if len(all_jobs) % SAVE_EVERY == 0:
                    save_json(out, all_jobs)
                if collected >= limit:
                    break
            print(f"  [remotive:{q or 'all'}] page {page}: {collected}/{limit} (+{new_in_page} new)",
                  flush=True)
            save_json(out, all_jobs)
            if new_in_page == 0:
                print(f"  [remotive:{q or 'all'}] only duplicates, next query")
                break
            page += 1
            time.sleep(pause)
    save_json(out, all_jobs)
    return collected


GETONBOARD_CATEGORIES = [
    "other", "education-coaching", "programming", "operations-management",
    "digital-marketing", "sales", "design-ux", "machine-learning-ai",
    "customer-support", "cybersecurity", "advertising-media",
    "hardware-electronics", "sysadmin-devops-qa", "innovation-agile",
    "technical-support", "hr", "mobile-developer", "data-science-analytics",
]


def collect_getonboard(limit: int, query: str, pause: float, out: str,
                       all_jobs: list[dict]) -> int:
    collected = 0
    seen_ids: set = set()
    if query:
        categories: list[str | None] = [None]
    else:
        categories = GETONBOARD_CATEGORIES
    for category in categories:
        if collected >= limit:
            break
        page = 1
        while collected < limit:
            if query:
                params = {"page": page, "per_page": 50, "query": query}
                url = ("https://www.getonbrd.com/api/v0/search/jobs?"
                       + urllib.parse.urlencode(params))
                label = f"search:{query}"
            else:
                params = {"page": page, "per_page": 50}
                url = (f"https://www.getonbrd.com/api/v0/categories/{category}/jobs?"
                       + urllib.parse.urlencode(params))
                label = category
            try:
                raw = fetch(url)
            except Exception as exc:  # noqa: BLE001
                print(f"  [getonboard] {label} page {page} ERROR: {exc}, waiting 10s...",
                      file=sys.stderr)
                time.sleep(10)
                continue
            data = json.loads(raw.decode("utf-8", errors="ignore"))
            jobs = data.get("data", [])
            if not jobs:
                print(f"  [getonboard] {label}: no more pages")
                break
            for job in jobs:
                job_id = job.get("id") or (job.get("links") or {}).get("public_url", "")
                if job_id in seen_ids:
                    continue
                seen_ids.add(job_id)
                attrs = job.get("attributes", {})
                company = attrs.get("company", {})
                company_name = company.get("name", "") if isinstance(company, dict) else ""
                item = normalize({
                    "title": attrs.get("title", ""),
                    "company": company_name,
                    "location": attrs.get("country", "") or ("Remote" if attrs.get("remote") else ""),
                    "modality": attrs.get("remote_modality", "") or ("remote" if attrs.get("remote") else ""),
                    "salary_min": attrs.get("min_salary"),
                    "salary_max": attrs.get("max_salary"),
                    "currency": attrs.get("currency", "") or "",
                    "description": clean_html(attrs.get("description", "")),
                    "url": (job.get("links") or {}).get("public_url", ""),
                    "date": attrs.get("published_at", ""),
                    "source": "getonboard",
                    "tags": [attrs.get("category_name", "")] if attrs.get("category_name") else [],
                })
                all_jobs.append(item)
                collected += 1
                if len(all_jobs) % SAVE_EVERY == 0:
                    save_json(out, all_jobs)
                if collected >= limit:
                    break
            meta = data.get("meta", {})
            print(f"  [getonboard] {label} page {page}/{meta.get('total_pages', '?')}: "
                  f"{collected}/{limit}", flush=True)
            save_json(out, all_jobs)
            if page >= meta.get("total_pages", page):
                break
            page += 1
            time.sleep(pause)
    save_json(out, all_jobs)
    return collected


def save_checkpoint(path: str, jobs: list[dict]) -> None:
    save_json(path, jobs)


def main() -> int:
    global SAVE_EVERY
    parser = argparse.ArgumentParser(description="Bulk collector: all working sources")
    parser.add_argument("--limit", type=int, default=500,
                        help="Jobs per source (soft cap; time budget wins)")
    parser.add_argument("--source-timeout", type=int, default=300,
                        help="Max seconds per source before moving on (default 5 min)")
    parser.add_argument("--max-pages", type=int, default=10,
                        help="Max HTML list pages per MX source (computrabajo/bumeran/occ)")
    parser.add_argument("--sources", default=",".join(BULK_SOURCES),
                        help="Comma-separated sources (see BULK_SOURCES)")
    parser.add_argument("--out", default="data/raw/jobs/jobs_bulk.json",
                        help="Output JSON file (rewritten live every N jobs)")
    parser.add_argument("--query", default="python", nargs="?", const="",
                        help="Search query, or comma-separated queries (omit value = all jobs)")
    parser.add_argument("--pause", type=float, default=PAGE_PAUSE,
                        help="Seconds between page requests")
    parser.add_argument("--save-every", type=int, default=SAVE_EVERY,
                        help="Rewrite JSON file every N jobs")
    parser.add_argument("--boards", default=",".join(GREENHOUSE_BOARDS),
                        help="Greenhouse boards to scrape")
    parser.add_argument("--lever-boards", default=",".join(LEVER_BOARDS),
                        help="Lever boards to scrape")
    parser.add_argument("--ashby-boards", default=",".join(ASHBY_BOARDS),
                        help="Ashby boards to scrape")
    parser.add_argument("--usajobs-key", default=os.environ.get("USAJOBS_KEY", ""),
                        help="USAJobs API key (or set USAJOBS_KEY env var; free at https://developer.usajobs.gov)")
    parser.add_argument("--dice-details", action="store_true", default=True,
                        help="Fetch Dice detail pages for real descriptions (default on)")
    parser.add_argument("--no-dice-details", dest="dice_details", action="store_false",
                        help="Skip Dice detail pages (fast, descriptions = salary only)")
    parser.add_argument("--max-details", type=int, default=100,
                        help="Max detail pages per source run (dice/MX)")
    args = parser.parse_args()

    global MX_MAX_PAGES, MX_MAX_DETAILS
    MX_MAX_PAGES = args.max_pages
    MX_MAX_DETAILS = args.max_details

    SAVE_EVERY = args.save_every
    SEEN_URLS.clear()
    save_json(args.out, [])
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    all_jobs: list[dict] = []
    total = 0

    def run_source(name: str, label: str, func, *fargs) -> None:
        nonlocal total
        print(f"[{label}] collecting (budget {args.source_timeout}s)...", flush=True)
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = pool.submit(func, *fargs)
        try:
            got = future.result(timeout=args.source_timeout)
            total += got
            print(f"[{label}] done: +{got}", flush=True)
        except concurrent.futures.TimeoutError:
            print(f"[{label}] TIME BUDGET exceeded, moving on "
                  f"({len(all_jobs)} jobs kept)", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            print(f"[{label}] ERROR: {exc}", file=sys.stderr)
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
            save_json(args.out, all_jobs)
        time.sleep(1)

    if "remotive" in sources:
        run_source("remotive", f"remotive query={args.query!r}",
                   collect_remotive, args.limit, args.query, args.pause,
                   args.out, all_jobs)
    if "getonboard" in sources:
        run_source("getonboard", f"getonboard query={args.query!r}",
                   collect_getonboard, args.limit, args.query, args.pause,
                   args.out, all_jobs)
    if "remoteok" in sources:
        run_source("remoteok", f"remoteok query={args.query!r}",
                   collect_remoteok, args.limit, args.query, args.pause,
                   args.out, all_jobs)
    if "dice" in sources:
        run_source("dice", f"dice query={args.query!r}",
                   collect_dice, args.limit, args.query, args.pause,
                   args.out, all_jobs, args.dice_details, args.max_details)
    if "yc" in sources:
        run_source("yc", "yc", collect_yc, args.limit, args.out, all_jobs)
    if "torre" in sources:
        run_source("torre", f"torre query={args.query!r}",
                   collect_torre, args.limit, args.query, args.out, all_jobs)
    if "workingnomads" in sources:
        run_source("workingnomads", "workingnomads",
                   collect_workingnomads, args.limit, args.pause,
                   args.out, all_jobs)
    if "wwr" in sources:
        run_source("wwr", "wwr",
                   collect_wwr, args.limit, args.pause, args.out, all_jobs)
    if "arbeitnow" in sources:
        run_source("arbeitnow", "arbeitnow",
                   collect_arbeitnow, args.limit, args.pause, args.out, all_jobs)
    if "greenhouse" in sources:
        boards = [b.strip() for b in args.boards.split(",") if b.strip()]
        run_source("greenhouse", f"greenhouse {len(boards)} boards",
                   collect_greenhouse, args.limit, args.pause, args.out,
                   all_jobs, boards)
    if "lever" in sources:
        boards = [b.strip() for b in args.lever_boards.split(",") if b.strip()]
        run_source("lever", f"lever {len(boards)} boards",
                   collect_lever, args.limit, args.pause, args.out,
                   all_jobs, boards)
    if "ashby" in sources:
        boards = [b.strip() for b in args.ashby_boards.split(",") if b.strip()]
        run_source("ashby", f"ashby {len(boards)} boards",
                   collect_ashby, args.limit, args.pause, args.out,
                   all_jobs, boards)
    if "usajobs" in sources:
        run_source("usajobs", f"usajobs query={args.query!r}",
                   collect_usajobs, args.limit, args.query, args.pause,
                   args.out, all_jobs, args.usajobs_key)
    if "ziprss" in sources:
        run_source("ziprss", f"ziprss query={args.query!r}",
                   collect_ziprss, args.limit, args.query, max(args.pause, 1.0),
                   args.out, all_jobs)
    if "computrabajo" in sources:
        run_source("computrabajo", "computrabajo",
                   collect_computrabajo, args.limit, args.query,
                   max(args.pause, 2.0), args.out, all_jobs)
    if "bumeran" in sources:
        run_source("bumeran", "bumeran",
                   collect_bumeran, args.limit, args.query,
                   max(args.pause, 2.0), args.out, all_jobs)
    if "occ" in sources:
        run_source("occ", "occ",
                   collect_occ, args.limit, args.query,
                   max(args.pause, 2.0), args.out, all_jobs)
    if "linkedin" in sources:
        run_source("linkedin", "linkedin",
                   collect_linkedin, args.limit, args.query,
                   max(args.pause, 2.0), args.out, all_jobs)
    if "empleo-gob" in sources:
        run_source("empleo-gob", "empleo-gob",
                   collect_empleo_gob, args.limit, args.query,
                   max(args.pause, 2.0), args.out, all_jobs)

    print(f"Saved: {args.out} ({len(all_jobs)} jobs, JSON)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
