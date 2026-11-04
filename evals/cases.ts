// Fixed cases for the AI evaluation. Written by hand, with the answer a careful person would accept.
import type { Modality } from "@/lib/vacancy";

// Two lines for each of the 16 vague phrases the detector knows. keep: facts the line gives, which a rewrite must not lose.
export const REWRITE_CASES: { line: string; keep: string[] }[] = [
  { line: "Work in a fast-paced environment", keep: [] },
  { line: "Answer 20 customer emails a day in a fast-paced team", keep: ["20", "emails"] },
  { line: "Join our dynamic team of data analysts", keep: ["data"] },
  { line: "Thrive in a dynamic work environment with weekly releases", keep: ["weekly", "releases"] },
  { line: "Be a team player", keep: [] },
  { line: "Team player who reviews code with other developers", keep: ["code"] },
  { line: "Excellent communication skills", keep: [] },
  { line: "Strong written and verbal communication skills for client reports", keep: ["client", "reports"] },
  { line: "Good interpersonal skills", keep: [] },
  { line: "A people person who greets visitors at the front desk", keep: ["visitors"] },
  { line: "Highly organized", keep: [] },
  { line: "Strong organizational skills to manage 3 project calendars", keep: ["3", "calendars"] },
  { line: "Able to work under pressure", keep: [] },
  { line: "Meet tight deadlines in a high-pressure warehouse", keep: ["warehouse"] },
  { line: "Must be able to multitask", keep: [] },
  { line: "Multitasking between phone calls and data entry in Excel", keep: ["phone", "Excel"] },
  { line: "Self-starter who needs little supervision", keep: [] },
  { line: "Self-starter who builds Power BI dashboards", keep: ["Power BI"] },
  { line: "Wear many hats in a small startup", keep: [] },
  { line: "Wear multiple hats: bookkeeping, payroll and scheduling", keep: ["bookkeeping", "payroll", "scheduling"] },
  { line: "Other duties as assigned", keep: [] },
  { line: "Update inventory counts and other duties as needed", keep: ["inventory"] },
  { line: "Looking for a rockstar developer", keep: ["developer"] },
  { line: "SQL ninja to maintain our reporting database", keep: ["SQL", "database"] },
  { line: "Outgoing personality to work with customers", keep: ["customers"] },
  { line: "High-energy sales associate for our retail store", keep: ["sales", "retail"] },
  { line: "Must be a culture fit", keep: [] },
  { line: "Strong cultural fit with our values of honesty and care", keep: ["honesty"] },
  { line: "Comfortable with ambiguity", keep: [] },
  { line: "Think on your feet when a delivery route changes", keep: ["delivery", "route"] },
  { line: "Hit the ground running from day one", keep: [] },
  { line: "Hit the ground running with our Zendesk support queue", keep: ["Zendesk"] },
];

// What a careful reader takes from each posting. null means the posting doesn't say, so the draft must leave it empty.
export type ExtractGold = {
  posting: string;
  company: string | null;
  salary: [number, number] | null;
  modality: Modality | null;
  responseDays: number | null;
  minutes: number[]; // every stated duration, in any order
  vague: string[]; // phrases that must stay in the draft, so the clarity score can flag them
};

export const EXTRACT_CASES: ExtractGold[] = [
  {
    posting: `Junior Data Analyst, Ceiba Foods (Guadalajara, hybrid)
What you will do:
- Pull last week's sales data with SQL
- Update the sales dashboard in Power BI
- Work in a fast-paced environment
You must have: basic SQL, Excel pivot tables, and be a team player.
Pay: $18,000 to $22,000 MXN per month. Monday to Friday, 9:00 to 17:00.
Hiring: written questions, 30 minutes. A paid sales report task, 90 minutes. A 30-minute video call with the team lead.
We answer within 5 days after each step.`,
    company: "Ceiba Foods",
    salary: [18000, 22000],
    modality: "hybrid",
    responseDays: 5,
    minutes: [30, 90, 30],
    vague: ["fast-paced", "team player"],
  },
  {
    posting: `Warehouse Assistant
Join our fast-paced team. You must be a team player.
You will pick orders, pack boxes and update stock counts in Excel.
We want a fast paced person with excellent communication skills.`,
    company: null,
    salary: null,
    modality: null,
    responseDays: null,
    minutes: [],
    vague: ["fast-paced", "team player", "excellent communication"],
  },
  {
    posting: `Customer Support Agent at Northwind Help (remote)
Answer about 40 chats a day in Zendesk and log each case.
Pay: USD 18 to 22 per hour. Monday to Friday, 8:00 to 16:00.
Hiring: a 20-minute written test, then a 30-minute video call with the support lead.
We reply within 3 days.`,
    company: "Northwind Help",
    salary: [18, 22],
    modality: "remote",
    responseDays: 3,
    minutes: [20, 30],
    vague: [],
  },
  {
    posting: `Bookkeeper - Lumen Dental, Monterrey (on-site)
Rockstar bookkeeper who can wear many hats.
Reconcile bank accounts in QuickBooks every week and prepare the monthly payroll.
Salary: MXN 15,000 per month. We offer a quiet office and written instructions for every task.`,
    company: "Lumen Dental",
    salary: [15000, 15000],
    modality: "on-site",
    responseDays: null,
    minutes: [],
    vague: ["Rockstar", "wear many hats"],
  },
  {
    posting: `QA Tester for a dynamic team at Bright Apps
Test our mobile app before each release and write bug reports in Jira.
Hybrid, in Guadalajara. Competitive salary. We answer within a week.`,
    company: "Bright Apps",
    salary: null,
    modality: "hybrid",
    responseDays: null, // "a week" isn't a number the posting states, so it must stay empty
    minutes: [],
    vague: ["dynamic team"],
  },
  {
    posting: `Graphic Designer, Kite Studio (remote)
Design about 10 social media posts a week in Figma.
USD 30,000 to 36,000 a year.
Two steps: send a portfolio, then a 45-minute video call with the art director.
Self-starter preferred.`,
    company: "Kite Studio",
    salary: [30000, 36000],
    modality: "remote",
    responseDays: null,
    minutes: [45],
    vague: ["Self-starter"],
  },
];

export const INTERVIEW_CASES: { title: string; tasks: string[]; essential: string[] }[] = [
  {
    title: "Junior Data Analyst",
    tasks: ["Pull last week's sales data with SQL", "Update the sales dashboard in Power BI", "Write a one-page summary every Friday"],
    essential: ["Write basic SQL queries", "Use Excel formulas and pivot tables", "Build simple charts and dashboards"],
  },
  {
    title: "Customer Support Agent",
    tasks: ["Answer about 40 chats a day in Zendesk", "Log each case with its outcome"],
    essential: ["Answer customers in writing", "Use a help desk tool such as Zendesk"],
  },
  {
    title: "Bookkeeper",
    tasks: ["Reconcile bank accounts in QuickBooks every week", "Prepare the monthly payroll"],
    essential: ["Reconcile bank accounts", "Use QuickBooks", "Prepare payroll"],
  },
  {
    title: "QA Tester",
    tasks: ["Test the mobile app before each release", "Write bug reports in Jira"],
    essential: ["Write clear bug reports", "Test mobile apps by hand"],
  },
];
