# Review Tracker (local)

This is a self-contained local version of the Review Tracker. It runs with TanStack Start and stores sections, students, groups, and reviews in `data/review-tracker.json`. It does not need Lovable, Supabase, or cloud credentials.

## Run on Windows

Install Node.js 22 or newer, then open PowerShell in this folder and run:

```powershell
npm install --legacy-peer-deps
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:3000`). Keep the terminal open while using the app. Stop it with **Ctrl+C**.

If `TEACHER_PASSWORD` is already set in `.env`, use that password. Otherwise the local teacher password is `admin`. To change it, add `TEACHER_PASSWORD=your-password` to `.env` and restart the app. Keep the existing `.env` values when adding this line.

Data is saved in `data/review-tracker.json` and remains on this computer. Back up that file to preserve your records. Deleting it resets the local data. Set `LOCAL_DATA_DIR` in the process environment if you want to store the data file elsewhere.

To create a production build locally, run `npm run build`.
