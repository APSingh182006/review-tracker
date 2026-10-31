import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSection, deleteSection, renameSection } from "@/lib/api.functions";

type Section = { id: string; name: string };

export function SectionsDialog({
  open, onOpenChange, token, sections, onChanged, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; token: string; sections: Section[];
  onChanged: () => void; onCreated: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<Section | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const s = await createSection({ data: { token, name: newName.trim() } });
      setNewName("");
      onChanged();
      onCreated(s.id);
      toast.success(`Section ${s.name} created`);
    } catch (err) { toast.error((err as Error).message); }
  }
  async function rename(id: string) {
    if (!editName.trim()) return;
    await renameSection({ data: { token, id, name: editName.trim() } });
    setEditing(null);
    onChanged();
  }
  async function remove() {
    if (!toDelete) return;
    await deleteSection({ data: { token, id: toDelete.id } });
    toast.success(`Deleted ${toDelete.name}`);
    setToDelete(null);
    onChanged();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manage sections</DialogTitle></DialogHeader>
          <form onSubmit={add} className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New section, e.g. CSE24" className="h-11" />
            <Button type="submit" className="h-11"><Plus /> Add</Button>
          </form>
          <ul className="mt-2 divide-y rounded-lg border">
            {sections.length === 0 && <li className="p-4 text-center text-muted-foreground">No sections yet</li>}
            {sections.map((s) => (
              <li key={s.id} className="flex items-center gap-2 p-2">
                {editing === s.id ? (
                  <>
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11"
                      onKeyDown={(e) => e.key === "Enter" && rename(s.id)} />
                    <Button size="icon" className="h-11 w-11 shrink-0" onClick={() => rename(s.id)} aria-label="Save"><Check /></Button>
                    <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" onClick={() => setEditing(null)} aria-label="Cancel"><X /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 px-2 font-medium">{s.name}</span>
                    <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Rename"
                      onClick={() => { setEditing(s.id); setEditName(s.name); }}><Pencil /></Button>
                    <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive" aria-label="Delete"
                      onClick={() => setToDelete(s)}><Trash2 /></Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All students, groups and reviews in this section will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>
              Delete section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
