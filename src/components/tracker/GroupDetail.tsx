import { useEffect, useState } from "react";
import { ExternalLink, Code2, Globe, CheckCircle2, Circle, Lock, Pencil, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateReview, updateFinal, updateLinks, type Group, type Review } from "@/lib/api.functions";
import { StatusBadge } from "./StatusBadge";

const today = () => new Date().toISOString().slice(0, 10);

function ReviewSlot({ r, token, onSaved, readOnly }: { r: Review; token: string; onSaved: () => void; readOnly: boolean }) {
  const [marks, setMarks] = useState(r.marks?.toString() ?? "");
  const [fb, setFb] = useState(r.feedback ?? "");
  useEffect(() => { setMarks(r.marks?.toString() ?? ""); setFb(r.feedback ?? ""); }, [r.id, r.marks, r.feedback]);

  async function save(patch: Partial<Review>) {
    const next = { done: r.done, done_date: r.done_date, marks: r.marks, feedback: r.feedback, ...patch };
    try {
      await updateReview({ data: { token, id: r.id, ...next } });
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
  }
  function commitMarks() {
    if (marks === "") { if (r.marks !== null) save({ marks: null }); return; }
    const n = Number(marks);
    if (Number.isNaN(n) || n < 0 || n > 10) { toast.error("Marks must be between 0 and 10"); setMarks(r.marks?.toString() ?? ""); return; }
    if (n !== r.marks) save({ marks: n });
  }

  return (
    <div className={`rounded-xl border p-4 ${r.done ? "border-success/40 bg-success-soft/40" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Review {r.review_no}</h3>
        <Button
          variant={r.done ? "default" : "outline"}
          disabled={readOnly}
          className={`h-11 min-w-28 disabled:opacity-100 ${r.done ? "bg-success text-primary-foreground hover:bg-success/90" : ""}`}
          onClick={() => save({ done: !r.done, done_date: !r.done ? (r.done_date ?? today()) : null })}
        >
          {r.done ? <CheckCircle2 /> : <Circle />} {r.done ? "Done" : "Pending"}
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm text-muted-foreground">Date
          <Input type="date" disabled={!r.done || readOnly} value={r.done_date ?? ""} className="mt-1 h-11 text-foreground"
            onChange={(e) => e.target.value && save({ done_date: e.target.value })} />
        </label>
        <label className="text-sm text-muted-foreground">Marks (0–10)
          <Input type="number" disabled={readOnly} inputMode="decimal" min={0} max={10} step={0.5} value={marks} placeholder="—"
            className="mt-1 h-11 text-foreground" onChange={(e) => setMarks(e.target.value)} onBlur={commitMarks} />
        </label>
      </div>
      {readOnly ? (r.feedback && <p className="mt-3 whitespace-pre-wrap text-sm">{r.feedback}</p>) :
      <Textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Feedback / notes" rows={2}
        className="mt-3" onBlur={() => fb !== (r.feedback ?? "") && save({ feedback: fb || null })} />}
    </div>
  );
}

export function GroupDetail({
  group, token, readOnly, onOpenChange, onSaved, onEdit, onDelete,
}: {
  group: Group | null; token: string; readOnly: boolean; onOpenChange: (o: boolean) => void;
  onSaved: () => void; onEdit: (g: Group) => void; onDelete: (g: Group) => void;
}) {
  const [remarks, setRemarks] = useState("");
  useEffect(() => setRemarks(group?.final_remarks ?? ""), [group?.id, group?.final_remarks]);
  const done = group?.reviews.filter((r) => r.done).length ?? 0;
  const unlocked = done === 5;
  const total = group?.reviews.reduce((a, r) => a + (r.marks ?? 0), 0) ?? 0;

  async function saveFinal(final_submitted: boolean, final_remarks: string | null) {
    if (!group) return;
    await updateFinal({ data: { token, id: group.id, final_submitted, final_remarks } });
    onSaved();
  }

  return (
    <Sheet open={!!group} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {group && (
          <>
            <SheetHeader className="text-left">
              <p className="text-sm font-medium text-muted-foreground">Group {group.group_no}</p>
              <SheetTitle className="font-display text-2xl">{group.title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <StatusBadge done={done} finalSubmitted={group.final_submitted} />
                <span className="text-sm text-muted-foreground">{done}/5 reviews · {total} / 50 marks</span>
              </div>
            </SheetHeader>
            <Links group={group} token={token} readOnly={readOnly} onSaved={onSaved} />
            {!readOnly && <div className="mt-4 flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onEdit(group)}><Pencil /> Edit</Button>
              <Button variant="outline" className="h-11 flex-1 text-destructive" onClick={() => onDelete(group)}><Trash2 /> Delete</Button>
            </div>}
            <ul className="mt-4 space-y-1 rounded-xl bg-muted p-3 text-sm">
              {group.members.map((m) => (
                <li key={m.id} className="flex gap-3"><span className="w-24 font-mono text-muted-foreground">{m.roll_no}</span>{m.name}</li>
              ))}
            </ul>
            <div className="mt-5 space-y-3">
              {group.reviews.map((r) => <ReviewSlot key={r.id} r={r} token={token} readOnly={readOnly} onSaved={onSaved} />)}
            </div>
            <div className={`mt-5 rounded-xl border-2 p-4 ${unlocked ? "border-success bg-success-soft/50" : "border-dashed opacity-70"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {unlocked ? <Trophy className="h-5 w-5 text-success" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                  <h3 className="text-lg font-semibold">Final submission</h3>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                  Submitted
                  <Switch disabled={readOnly || (!unlocked && !group.final_submitted)} checked={group.final_submitted}
                    onCheckedChange={(v) => saveFinal(v, group.final_remarks)} />
                </label>
              </div>
              {!unlocked && <p className="mt-1 text-sm text-muted-foreground">Unlocks once all 5 reviews are done.</p>}
              {readOnly ? (group.final_remarks && <p className="mt-3 whitespace-pre-wrap text-sm">{group.final_remarks}</p>) :
              <Textarea value={remarks} disabled={!unlocked} onChange={(e) => setRemarks(e.target.value)}
                onBlur={() => remarks !== (group.final_remarks ?? "") && saveFinal(group.final_submitted, remarks || null)}
                placeholder="Final remarks (optional)" rows={2} className="mt-3" />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Links({ group, token, readOnly, onSaved }: { group: Group; token: string; readOnly: boolean; onSaved: () => void }) {
  const [p, setP] = useState(group.project_link ?? "");
  const [g, setG] = useState(group.github_link ?? "");
  useEffect(() => { setP(group.project_link ?? ""); setG(group.github_link ?? ""); }, [group.id, group.project_link, group.github_link]);
  async function save() {
    const fix = (v: string) => { const t = v.trim(); return !t ? null : /^https?:\/\//i.test(t) ? t : `https://${t}`; };
    const np = fix(p), ng = fix(g);
    if (np === group.project_link && ng === group.github_link) return;
    try { await updateLinks({ data: { token, id: group.id, project_link: np, github_link: ng } }); toast.success("Links saved"); onSaved(); }
    catch { toast.error("Please enter a valid link"); }
  }
  if (readOnly) {
    if (!group.project_link && !group.github_link) return <p className="mt-4 text-sm text-muted-foreground">No project links added yet.</p>;
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {group.project_link && <Button asChild variant="outline" className="h-11"><a href={group.project_link} target="_blank" rel="noopener noreferrer"><Globe /> View project <ExternalLink className="h-3 w-3" /></a></Button>}
        {group.github_link && <Button asChild variant="outline" className="h-11"><a href={group.github_link} target="_blank" rel="noopener noreferrer"><Code2 /> GitHub <ExternalLink className="h-3 w-3" /></a></Button>}
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2 rounded-xl border p-3">
      <h3 className="font-semibold">Project links</h3>
      <label className="flex items-center gap-2"><Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
        <Input value={p} onChange={(e) => setP(e.target.value)} onBlur={save} placeholder="Live project link" className="h-11" /></label>
      <label className="flex items-center gap-2"><Code2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        <Input value={g} onChange={(e) => setG(e.target.value)} onBlur={save} placeholder="GitHub link" className="h-11" /></label>
    </div>
  );
}
