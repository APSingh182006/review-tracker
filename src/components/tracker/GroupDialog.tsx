import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { saveGroup, type Group, type Student } from "@/lib/api.functions";

export function GroupDialog({
  open, onOpenChange, token, sectionId, students, groups, editing, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; token: string; sectionId: string;
  students: Student[]; groups: Group[]; editing: Group | null; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [showTaken, setShowTaken] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setSel(new Set(editing?.members.map((m) => m.id) ?? []));
      setQ("");
    }
  }, [open, editing]);

  const groupNo = useMemo(() => new Map(groups.map((g) => [g.id, g.group_no])), [groups]);
  const list = students.filter((s) => {
    const taken = s.group_id && s.group_id !== editing?.id;
    if (taken && !showTaken) return false;
    return (s.name + " " + s.roll_no).toLowerCase().includes(q.toLowerCase());
  });

  function toggle(id: string) {
    setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save() {
    if (!title.trim()) { toast.error("Project title is required"); return; }
    if (!sel.size) { toast.error("Select at least one student"); return; }
    setBusy(true);
    try {
      await saveGroup({ data: { token, sectionId, groupId: editing?.id, title: title.trim(), studentIds: [...sel] } });
      toast.success(editing ? "Group updated" : "Group created");
      onSaved();
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col">
        <DialogHeader><DialogTitle>{editing ? `Edit Group ${editing.group_no}` : "New group"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="title">Project title / topic *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" placeholder="e.g. Smart Attendance System" />
        </div>
        <div className="flex items-center justify-between">
          <Label>Members <span className="text-muted-foreground">({sel.size} selected)</span></Label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={showTaken} onCheckedChange={(v) => setShowTaken(!!v)} /> Show assigned
          </label>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or roll number" className="h-11" />
        <div className="min-h-40 flex-1 overflow-y-auto rounded-lg border">
          {list.map((s) => {
            const taken = !!s.group_id && s.group_id !== editing?.id;
            return (
              <label key={s.id}
                className={`flex min-h-12 items-center gap-3 border-b px-3 last:border-0 ${taken ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"}`}>
                <Checkbox disabled={taken} checked={sel.has(s.id)} onCheckedChange={() => toggle(s.id)} className="h-5 w-5" />
                <span className="w-24 shrink-0 font-mono text-sm">{s.roll_no}</span>
                <span className="flex-1">{s.name}</span>
                {taken && <span className="text-xs text-muted-foreground">Group {groupNo.get(s.group_id!)}</span>}
              </label>
            );
          })}
          {list.length === 0 && <p className="p-6 text-center text-muted-foreground">No available students</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-11" onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
