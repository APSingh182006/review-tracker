export type GroupStatus = "not_started" | "in_progress" | "completed";

export function groupStatus(doneCount: number, finalSubmitted: boolean): GroupStatus {
  if (doneCount >= 5 && finalSubmitted) return "completed";
  if (doneCount === 0 && !finalSubmitted) return "not_started";
  return "in_progress";
}

export const STATUS_LABEL: Record<GroupStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};
