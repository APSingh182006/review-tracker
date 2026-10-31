# Local Review Tracker

- The local app stores its data in `data/review-tracker.json`; keep that directory out of version control.
- App reads and writes go through server functions in `src/lib/api.functions.ts`.
- Local teacher login defaults to `admin`; `TEACHER_PASSWORD` in `.env` can override it.
- The local version should not require a remote database or hosted editor to run.
