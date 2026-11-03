import { publicJson, publicOptions } from "@/app/api/public/cors";
import { publicVacancy } from "@/lib/public-employer";
import { readSnapshot } from "@/lib/public-store";

export const OPTIONS = publicOptions;

export async function GET(_req: Request, { params }: RouteContext<"/api/public/vacancies/[id]">) {
  const { id } = await params;
  const vacancy = publicVacancy(await readSnapshot(), id, new Date());
  return vacancy ? publicJson(vacancy) : publicJson({ error: "not_found" }, 404);
}
