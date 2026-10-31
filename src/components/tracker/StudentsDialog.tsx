import { useRef, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { importStudents, deleteStudent, type Student } from "@/lib/api.functions";

function normKey(k: string) { return k.toLowerCase().replace(/[^a-z]/g, ""); }

async function parseFile(file: File) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!rows.length) return [];
  const header = (rows[0] as unknown[]).map((h) => normKey(String(h)));
  let ri = header.findIndex((h) => h.includes("roll"));
  let ni = header.findIndex((h) => h.includes("name"));
  let body = rows.slice(1);
  if (ri < 0 || ni < 0) { ri = 0; ni = 1; body = rows; } // no header row
  return body
    .map((r) => ({ roll_no: String(r[ri] ?? "").trim(), name: String(r[ni] ?? "").trim() }))
    .filter((r) => r.roll_no && r.name);
}

export function StudentsDialog({
  open, onOpenChange, token, sectionId, sectionName, students, onChanged,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; token: string; sectionId: string; sectionName: string;
  students: Student[]; onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const rows = await parseFile(f);
      if (!rows.length) { toast.error("No rows found. Expected columns: Roll Number, Student Name"); return; }
      const r = await importStudents({ data: { token, sectionId, rows } });
      toast.success(`Imported ${r.count} students`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  const filtered = students.filter((s) =>
    (s.name + " " + s.roll_no).toLowerCase().includes(q.toLowerCase()));
  const assigned = students.filter((s) => s.group_id).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Students · {sectionName}</DialogTitle>
          <DialogDescription>
            Upload .xlsx or .csv with columns <b>Roll Number</b> and <b>Student Name</b>. Re-uploading updates names and adds new students — group assignments are kept.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          <Button className="h-11" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Import file
          </Button>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" className="h-11" />
        </div>
        <p className="text-sm text-muted-foreground">{students.length} students · {assigned} assigned · {students.length - assigned} unassigned</p>
        <div className="-mx-1 flex-1 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr><th className="p-3">Roll No.</th><th className="p-3">Name</th><th className="p-3">Status</th><th className="w-12" /></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-mono">{s.roll_no}</td>
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">
                    {s.group_id
                      ? <Badge className="bg-success-soft text-success-foreground hover:bg-success-soft">Assigned</Badge>
                      : <Badge variant="secondary">Unassigned</Badge>}
                  </td>
                  <td className="pr-1">
                    <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground" aria-label="Remove student"
                      onClick={async () => {
                        if (!confirm(`Remove ${s.name}?`)) return;
                        await deleteStudent({ data: { token, id: s.id } });
                        onChanged();
                      }}><Trash2 /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No students yet — import a file to begin.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
