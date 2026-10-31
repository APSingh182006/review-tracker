# Project Review Tracker

A web app for organizing student project groups and tracking progress through five reviews. Teachers can manage class sections and rosters, record marks and feedback, track attendance and final submissions, view attendance charts, and export section data to Excel.

## Features

- Create, rename, and manage class sections.
- Import student lists from `.xlsx`, `.xls`, or `.csv` files with **Roll Number** and **Student Name** columns.
- Create groups, assign students, and add project and GitHub links.
- Track five reviews per group, including completion, date, marks, and feedback.
- Mark students present or absent for each review, with a group attendance chart.
- Record final submission status and remarks.
- Export group details and section attendance to separate Excel workbooks.
- Browse in read-only student view; sign in as a teacher to make changes.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

From the project directory, open PowerShell and run:

```powershell
npm install --legacy-peer-deps
npm run dev
```

Open the local address printed by Vite in your browser. Keep the terminal running while you use the app. Press **Ctrl+C** in that terminal to stop it.

## Teacher password

The teacher password defaults to `admin` when `TEACHER_PASSWORD` is not set. To choose a password, create a `.env` file in the project directory:

```env
TEACHER_PASSWORD=your-password
```

Restart the dev server after changing `.env`. The `.env` file is excluded from Git; never commit it.

## Data storage

When running locally without a database URL, records are stored in `data/review-tracker.json`. The file is created on the first saved change and is excluded from Git. Back it up regularly if you need to preserve your records.

For a hosted deployment, configure a PostgreSQL connection string as `DATABASE_URL` or `POSTGRES_URL`. The app will create its `review_tracker_state` table and initialize an empty tracker on first use. Vercel deployments require this setting because function filesystems do not provide durable storage. A hosted database starts empty; local records are not uploaded automatically.

## Deploy to Vercel

The repository includes the Nitro Vite plugin and `vercel.json` framework configuration required for TanStack Start on Vercel. See [Vercel's TanStack Start deployment guide](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel).

1. Push the project to GitHub and import the repository in Vercel.
2. Provision a PostgreSQL database through a Vercel Marketplace integration, such as Neon, and make its connection string available to the project as `DATABASE_URL` or `POSTGRES_URL`.
3. In the Vercel project settings, add `TEACHER_PASSWORD` as an environment variable for Production (and Preview if needed). Use the password you intend for the hosted site; do not put it in source files.
4. Deploy or redeploy the project. The app initializes an empty database the first time it is used.

Keep the database URL and teacher password private. The hosted deployment is separate from the local JSON data file.

## Project scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest test suite |

## Technology

- React and TypeScript
- TanStack Start and TanStack Router
- Vite and Nitro
- Tailwind CSS and Radix UI
- PostgreSQL for hosted persistence; JSON file storage for local-only use
- SheetJS (`xlsx`) for spreadsheet import and export
