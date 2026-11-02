import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LogOut, Plus, Search, Settings2, KeyRound, Users, Loader2, FolderPlus, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listSections, getSectionData, deleteGroup, verifyToken, importSectionWorkbook, type Group } from "@/lib/api.functions";
import { clearToken, getToken, getLastSection, setLastSection } from "@/lib/session";
import { groupStatus, type GroupStatus } from "@/lib/status";
import { Login } from "./Login";
import { SectionsDialog } from "./SectionsDialog";
import { StudentsDialog } from "./StudentsDialog";
import { GroupDialog } from "./GroupDialog";
import { GroupDetail } from "./GroupDetail";
import { GroupCard } from "./GroupCard";
import { downloadAttendanceWorkbook, downloadSectionWorkbook } from "@/lib/export-section";
import { parseSectionWorkbook } from "@/lib/import-section";

export function TrackerApp() {
  const [token, setTokenState] = useState<string | null>(null);
  useEffect(() => {
    const t = getToken();
    if (!t) return setTokenState("");
    verifyToken({ data: { token: t } }).then((r) => {
      if (r.ok) setTokenState(t); else { clearToken(); setTokenState(""); }
    }).catch(() => setTokenState(t));
  }, []);
  if (token === null) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  return <TokenSwitch token={token} setToken={setTokenState} />;
}

function TokenSwitch({ token, setToken }: { token: string; setToken: (t: string) => void }) {
  const [loginOpen, setLoginOpen] = useState(false);
  if (loginOpen && !token) return <Login onSuccess={(t) => { setToken(t); setLoginOpen(false); }} onCancel={() => setLoginOpen(false)} />;
  return <Dashboard token={token} onLogin={() => setLoginOpen(true)} onLogout={() => { clearToken(); setToken(""); }} />;
}

const FILTERS: { key: "all" | GroupStatus; label: string }[] = [
  { key: "all", label: "All" }, { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" }, { key: "completed", label: "Completed" },
];

function Dashboard({ token, onLogout, onLogin }: { token: string; onLogout: () => void; onLogin: () => void }) {
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importingWorkbook, setImportingWorkbook] = useState(false);
  const isTeacher = !!token;
  const qc = useQueryClient();
  const sectionsQ = useQuery({ queryKey: ["sections"], queryFn: () => listSections({ data: { token } }) });
  const sections = sectionsQ.data ?? [];
  const [sectionId, setSectionId] = useState("");
  useEffect(() => {
    if (!sections.length) { setSectionId(""); return; }
    if (!sections.some((s) => s.id === sectionId)) {
      const last = getLastSection();
      setSectionId(sections.some((s) => s.id === last) ? last : sections[0]!.id);
    }
  }, [sections, sectionId]);
  useEffect(() => { if (sectionId) setLastSection(sectionId); }, [sectionId]);

  const dataQ = useQuery({
    queryKey: ["section", sectionId],
    queryFn: () => getSectionData({ data: { token, sectionId } }),
    enabled: !!sectionId,
  });
  const students = dataQ.data?.students ?? [];
  const groups = dataQ.data?.groups ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["section", sectionId] });
  const refreshSections = () => qc.invalidateQueries({ queryKey: ["sections"] });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | GroupStatus>("all");
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Group | null>(null);
  const detail = groups.find((g) => g.id === detailId) ?? null;
  const section = sections.find((s) => s.id === sectionId);

  const counts = useMemo(() => {
    const c = { all: groups.length, not_started: 0, in_progress: 0, completed: 0 };
    groups.forEach((g) => c[groupStatus(g.reviews.filter((r) => r.done).length, g.final_submitted)]++);
    return c;
  }, [groups]);

  const visible = groups.filter((g) => {
    const st = groupStatus(g.reviews.filter((r) => r.done).length, g.final_submitted);
    if (filter !== "all" && st !== filter) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return g.title.toLowerCase().includes(needle) ||
      g.members.some((m) => m.name.toLowerCase().includes(needle) || m.roll_no.toLowerCase().includes(needle));
  });

  async function confirmDeleteGroup() {
    if (!toDelete) return;
    await deleteGroup({ data: { token, id: toDelete.id } });
    toast.success(`Group ${toDelete.group_no} deleted`);
    setToDelete(null);
    setDetailId(null);
    refresh();
  }

  async function exportSection() {
    if (!section || dataQ.isLoading) return;
    try {
      await downloadSectionWorkbook(section.name, groups, students);
      toast.success("Excel export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export this section");
    }
  }

  async function exportAttendance() {
    if (!section || dataQ.isLoading) return;
    try {
      await downloadAttendanceWorkbook(section.name, groups, students);
      toast.success("Attendance export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export attendance");
    }
  }

  async function importWorkbook(file: File) {
    if (!sectionId || !section) return;
    if (groups.length || students.length) {
      toast.error("Import the workbook into a new, empty section so existing data is not changed.");
      return;
    }
    setImportingWorkbook(true);
    try {
      const payload = await parseSectionWorkbook(file);
      const result = await importSectionWorkbook({ data: { token, sectionId, payload } });
      await refresh();
      toast.success(`Imported ${result.groups} groups and ${result.students} students into ${section.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import this workbook");
    } finally {
      setImportingWorkbook(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-header text-primary-foreground shadow-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            <span className="hidden font-display text-lg font-semibold sm:inline">Review Tracker</span>
          </div>
          <div className="flex flex-1 items-center gap-2 sm:justify-center">
            <Select value={sectionId} onValueChange={setSectionId} disabled={!sections.length}>
              <SelectTrigger className="h-11 w-full max-w-60 border-primary-foreground/30 bg-primary-foreground/10 text-base font-semibold text-primary-foreground">
                <SelectValue placeholder="No sections" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s.id} value={s.id} className="h-11 text-base">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isTeacher && <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              aria-label="Manage sections" onClick={() => setSectionsOpen(true)}><Settings2 /></Button>}
          </div>
          {isTeacher ? (
            <Button variant="ghost" className="h-11 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={onLogout}>
              <LogOut /> <span className="hidden sm:inline">Logout</span>
            </Button>
          ) : (
            <Button variant="ghost" className="h-11 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={onLogin}>
              <KeyRound /> <span className="hidden sm:inline">Teacher login</span>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {sectionsQ.isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : !sections.length ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-10 text-center shadow-card">
            <FolderPlus className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-2xl font-semibold">{isTeacher ? "Create your first section" : "No sections yet"}</h2>
            <p className="mt-1 text-muted-foreground">{isTeacher ? "Add a class section like CSE2 to start tracking projects." : "Your teacher hasn't added any sections yet."}</p>
            {isTeacher && <Button className="mt-5 h-12 px-6 text-base" onClick={() => setSectionsOpen(true)}><Plus /> Add section</Button>}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold">{section?.name}</h1>
                <p className="text-muted-foreground">{groups.length} groups · {students.length} students</p>
              </div>
              {isTeacher && <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-11 flex-1 md:flex-none" disabled={!section || dataQ.isLoading}
                  onClick={exportSection}><Download /> Export Excel</Button>
                <Button variant="outline" className="h-11 flex-1 md:flex-none" disabled={!section || dataQ.isLoading}
                  onClick={exportAttendance}><Download /> Export Attendance</Button>
                <Button variant="outline" className="h-11 flex-1 md:flex-none" onClick={() => setStudentsOpen(true)}><Users /> Students</Button>
                <Button className="h-11 flex-1 md:flex-none" disabled={!students.length}
                  onClick={() => { setEditing(null); setGroupOpen(true); }}><Plus /> New group</Button>
              </div>}
            </div>

            <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by project, student name or roll number"
                  className="h-12 bg-card pl-10 text-base" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>
                    {f.label} <span className="opacity-70">{counts[f.key]}</span>
                  </button>
                ))}
              </div>
            </div>

            {dataQ.isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
            ) : !students.length ? (
              <div className="mt-8 rounded-2xl border border-dashed bg-card p-10 text-center">
                <p className="text-lg font-medium">No students in this section yet</p>
                {isTeacher && <>
                <p className="text-muted-foreground">Import your class list (.xlsx or .csv) to begin forming groups.</p>
                <Button className="mt-4 h-11" onClick={() => setStudentsOpen(true)}><Users /> Import students</Button>
                {!groups.length && <>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void importWorkbook(file);
                }} />
                <div className="mt-3 flex flex-col items-center">
                  <Button variant="outline" className="h-11" disabled={!section || dataQ.isLoading || importingWorkbook}
                    onClick={() => importFileRef.current?.click()}>
                    {importingWorkbook ? <Loader2 className="animate-spin" /> : <Upload />} Import from Excel
                  </Button>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Use a Review Tracker export to restore all students, groups, reviews, attendance, and project details into this empty section.
                  </p>
                </div>
                </>}
                </>}
              </div>
            ) : visible.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground">{groups.length ? "No groups match your search." : "No groups yet — create one with “New group”."}</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((g) => <GroupCard key={g.id} group={g} onClick={() => setDetailId(g.id)} />)}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span>Guided by</span>
            <a href="https://www.researchgate.net/profile/Raghunath-Dey-2" target="_blank" rel="noreferrer" aria-label="Raghunath Dey on ResearchGate" className="font-medium text-foreground transition-colors hover:text-primary">Raghunath Dey</a>
          </span>
          <span className="h-4 border-l" aria-hidden="true" />
          <span className="font-medium text-foreground">Built by</span>
          <span className="flex items-center gap-3">
            <span>Anand <span className="font-mono text-xs text-muted-foreground/80">2405788</span></span>
            <a href="https://www.linkedin.com/in/anand-prakash-singh-4042692ba" target="_blank" rel="noreferrer" aria-label="Anand on LinkedIn" className="transition-colors hover:text-primary">LinkedIn</a>
            <a href="https://github.com/APSingh182006" target="_blank" rel="noreferrer" aria-label="Anand on GitHub" className="transition-colors hover:text-primary">GitHub</a>
          </span>
          <span className="h-4 border-l" aria-hidden="true" />
          <span className="flex items-center gap-3">
            <span>Raghvender <span className="font-mono text-xs text-muted-foreground/80">2405825</span></span>
            <a href="https://github.com/Raghav8826" target="_blank" rel="noreferrer" aria-label="Raghvender on GitHub" className="transition-colors hover:text-primary">GitHub</a>
          </span>
          <span className="h-4 border-l" aria-hidden="true" />
          <span>Akshansh <span className="font-mono text-xs text-muted-foreground/80">2405787</span></span>
        </div>
      </footer>

      <SectionsDialog open={sectionsOpen} onOpenChange={setSectionsOpen} token={token} sections={sections}
        onChanged={refreshSections} onCreated={(id) => { setSectionId(id); setSectionsOpen(false); }} />
      {sectionId && isTeacher && (
        <>
          <StudentsDialog open={studentsOpen} onOpenChange={setStudentsOpen} token={token} sectionId={sectionId}
            sectionName={section?.name ?? ""} students={students} onChanged={refresh} />
          <GroupDialog open={groupOpen} onOpenChange={setGroupOpen} token={token} sectionId={sectionId}
            students={students} groups={groups} editing={editing} onSaved={refresh} />
        </>
      )}
      <GroupDetail group={detail} token={token} readOnly={!isTeacher} onOpenChange={(o) => !o && setDetailId(null)} onSaved={refresh}
        onEdit={(g) => { setEditing(g); setGroupOpen(true); }} onDelete={setToDelete} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group {toDelete?.group_no}?</AlertDialogTitle>
            <AlertDialogDescription>“{toDelete?.title}” and all its review records will be deleted. Students become unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteGroup}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
