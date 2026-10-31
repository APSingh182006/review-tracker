import { CheckCircle2 } from "lucide-react";
import { groupStatus, STATUS_LABEL } from "@/lib/status";

const STYLE = {
  not_started: "bg-secondary text-muted-foreground",
  in_progress: "bg-warning-soft text-warning-foreground",
  completed: "bg-success text-primary-foreground",
};

export function StatusBadge({ done, finalSubmitted }: { done: number; finalSubmitted: boolean }) {
  const s = groupStatus(done, finalSubmitted);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLE[s]}`}>
      {s === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
      {STATUS_LABEL[s]}
    </span>
  );
}
