import { useEffect, useState } from "react";
import { ExternalLink, Code2, Globe, CheckCircle2, Circle, Lock, Pencil, Trash2, Trophy, ChartColumnIncreasing, Check } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateReview, updateAttendance, updateFinal, updateLinks, type Group, type Review } from "@/lib/api.functions";
import { StatusBadge } from "./StatusBadge";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const today = () => new Date().toISOString().slice(0, 10);

function ReviewSlot({ r, members, token, onSaved, readOnly }: { r: Review; members: Group["members"]; token: string; onSaved: () => void; readOnly: boolean }) {
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
      <AttendanceRoster review={r} members={members} token={token} readOnly={readOnly} onSaved={onSaved} />
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
  const [chartOpen, setChartOpen] = useState(false);
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl [&>button:first-child]:fixed [&>button:first-child]:right-4 [&>button:first-child]:top-4 [&>button:first-child]:z-[60] [&>button:first-child>svg]:h-5 [&>button:first-child>svg]:w-5">
        {group && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Group {group.group_no}</p>
                  <SheetTitle className="font-display text-2xl">{group.title}</SheetTitle>
                </div>
                <Button variant="outline" className="h-10 shrink-0" onClick={() => setChartOpen(true)}>
                  <ChartColumnIncreasing /> <span className="hidden sm:inline">Attendance Chart</span><span className="sm:hidden">Chart</span>
                </Button>
              </div>
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
              {group.reviews.map((r) => <ReviewSlot key={r.id} r={r} members={group.members} token={token} readOnly={readOnly} onSaved={onSaved} />)}
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
      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attendance · Group {group?.group_no}</DialogTitle>
            <DialogDescription>Reviews attended by each student, out of five.</DialogDescription>
          </DialogHeader>
          {group && <AttendanceChart group={group} />}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function AttendanceRoster({ review, members, token, readOnly, onSaved }: {
  review: Review; members: Group["members"]; token: string; readOnly: boolean; onSaved: () => void;
}) {
  const [presentIds, setPresentIds] = useState<string[]>(review.present_student_ids ?? []);
  const [saving, setSaving] = useState(false);
  useEffect(() => setPresentIds(review.present_student_ids ?? []), [review.id, review.present_student_ids]);
  const attendanceRecorded = review.present_student_ids !== null;

  async function setAttendance(next: string[]) {
    const previous = presentIds;
    setPresentIds(next);
    setSaving(true);
    try {
      await updateAttendance({ data: { token, id: review.id, present_student_ids: next } });
      onSaved();
    } catch (error) {
      setPresentIds(previous);
      toast.error(error instanceof Error ? error.message : "Could not save attendance");
    } finally { setSaving(false); }
  }

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Attendance</h4>
          <p className="text-xs text-muted-foreground">{attendanceRecorded ? `${presentIds.length}/${members.length} present` : "Not recorded"}</p>
        </div>
        {!readOnly && <Button type="button" variant="outline" size="sm" className="h-9" disabled={saving || !members.length || presentIds.length === members.length}
          onClick={() => setAttendance(members.map((member) => member.id))}><Check /> Mark All Present</Button>}
      </div>
      <ul className="space-y-2">
        {members.map((member) => {
          const present = presentIds.includes(member.id);
          return <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <span className="min-w-0 text-sm"><span className="mr-3 inline-block min-w-16 font-mono text-muted-foreground">{member.roll_no}</span>{member.name}</span>
            {readOnly ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!attendanceRecorded ? "bg-muted text-muted-foreground" : present ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive"}`}>
                {!attendanceRecorded ? "Not recorded" : present ? "Present" : "Absent"}
              </span>
            ) : (
              <button type="button" disabled={saving} aria-pressed={present} onClick={() => setAttendance(present ? presentIds.filter((id) => id !== member.id) : [...presentIds, member.id])}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-60 ${present ? "border-success bg-success-soft text-success" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>
                {present ? "Present" : "Absent"}
              </button>
            )}
          </li>;
        })}
      </ul>
    </div>
  );
}

function AttendanceChart({ group }: { group: Group }) {
  const data = group.members.map((member) => {
    const attended = group.reviews.filter((review) => review.present_student_ids?.includes(member.id)).length;
    return { name: member.name, rollNo: member.roll_no, attended, percentage: Math.round(attended / 5 * 100) };
  });
  return (
    <div className="h-[360px] w-full rounded-xl border bg-card p-3 text-card-foreground sm:p-5">
      {!data.length ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No group members to chart.</div> :
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rollNo" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={({ active, payload }) => {
              const item = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !item) return null;
              return <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                <p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Roll No: {item.rollNo}</p>
                <p className="mt-1 text-sm">Reviews Attended: {item.attended}/5</p><p className="text-sm">Attendance: {item.percentage}%</p>
              </div>;
            }} />
            <Bar dataKey="attended" name="Reviews attended" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>}
    </div>
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
