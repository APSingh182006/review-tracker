import { Code2, Globe } from "lucide-react";
import type { Group } from "@/lib/api.functions";
import { groupStatus } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";

export function GroupCard({ group, onClick }: { group: Group; onClick: () => void }) {
  const done = group.reviews.filter((r) => r.done).length;
  const total = group.reviews.reduce((a, r) => a + (r.marks ?? 0), 0);
  const completed = groupStatus(done, group.final_submitted) === "completed";
  return (
    <button onClick={onClick}
      className={`flex w-full flex-col rounded-2xl border bg-card p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${completed ? "border-success/50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">G{group.group_no}</span>
        <StatusBadge done={done} finalSubmitted={group.final_submitted} />
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug">{group.title}</h3>
      <ul className="mt-2 flex-1 space-y-0.5 text-sm">
        {group.members.map((m) => (
          <li key={m.id} className="flex gap-2"><span className="font-mono text-muted-foreground">{m.roll_no}</span><span className="truncate">{m.name}</span></li>
        ))}
      </ul>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">{done}/5 Reviews Done
            {group.project_link && <Globe className="h-4 w-4 text-primary" aria-label="Has project link" />}
            {group.github_link && <Code2 className="h-4 w-4 text-primary" aria-label="Has GitHub link" />}</span>
          <span className="text-muted-foreground">{total} marks</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full transition-all ${completed ? "bg-success" : "bg-primary"}`} style={{ width: `${done * 20}%` }} />
        </div>
      </div>
    </button>
  );
}
