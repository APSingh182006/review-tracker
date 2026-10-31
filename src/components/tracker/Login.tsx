import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/api.functions";
import { setToken } from "@/lib/session";

export function Login({ onSuccess, onCancel }: { onSuccess: (t: string) => void; onCancel?: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(false);
    try {
      const r = await login({ data: { password: pw } });
      if (r.ok) {
        setToken(r.token);
        onSuccess(r.token);
      } else setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-header px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-center text-2xl font-semibold">Project Review Tracker</h1>
        <p className="mt-1 text-center text-muted-foreground">Enter your teacher password</p>
        <Input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="mt-6 h-12 text-base"
        />
        {err && <p className="mt-2 text-sm text-destructive">Incorrect password</p>}
        <Button type="submit" disabled={busy || !pw} className="mt-4 h-12 w-full text-base">
          {busy && <Loader2 className="animate-spin" />} Sign in
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} className="mt-2 h-11 w-full">Back to student view</Button>}
      </form>
    </div>
  );
}
