import { Progress } from "@/components/ui/progress";
import { CLEAR_SCORE, type Clarity } from "@/lib/vacancy";

// Explains every point the score takes off, each with how to get it back.
export function ClarityPanel({ clarity: { score, issues } }: { clarity: Clarity }) {
  return (
    <section aria-labelledby="clarity-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <h2 id="clarity-heading" className="text-lg font-semibold">
        Clarity score
      </h2>
      <p role="status" className="text-muted-foreground">
        <strong className="text-4xl font-bold text-foreground">{score}</strong> of 100.{" "}
        {score >= CLEAR_SCORE ? "This vacancy is clear." : `A vacancy is clear at ${CLEAR_SCORE}.`}
      </p>
      <Progress value={score} aria-label="Clarity score" />
      {issues.length > 0 ? (
        <>
          <h3 className="font-semibold">What to fix</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {issues.map((issue) => (
              <li key={issue.id} className="flex items-start justify-between gap-3">
                <span>{issue.fix}</span>
                {issue.points > 0 && (
                  <span className="shrink-0 font-semibold tabular-nums">
                    +{issue.points}
                    <span className="sr-only"> points</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>There is nothing left to fix.</p>
      )}
    </section>
  );
}
