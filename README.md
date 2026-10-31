# Project Review Tracker

A local web app for organizing student project groups and tracking their progress through five reviews. Teachers can manage class sections and rosters, record marks and feedback, track final submissions, and export section data to Excel.

## Features

- Create, rename, and manage class sections.
- Import student lists from `.xlsx`, `.xls`, or `.csv` files with **Roll Number** and **Student Name** columns. Re-importing a roster updates student names while keeping group assignments.
- Create groups, assign students, and add project and GitHub links.
- Track five reviews per group, including completion status, date, marks from 0 to 10, and feedback.
- Record final submission status and remarks.
- View group progress as Not Started, In Progress, or Completed.
- Export the selected section to an `.xlsx` workbook with a **Groups** sheet and an **Unassigned Students** sheet. The export includes all groups in the section, even when the page is filtered.
- Browse the tracker in read-only student view; sign in as a teacher to make changes.

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

The local teacher password defaults to `admin` when `TEACHER_PASSWORD` is not set. To choose your own password, create a `.env` file in the project directory with:

```env
TEACHER_PASSWORD=your-local-password
```

Restart the dev server after changing `.env`. The `.env` file is excluded from Git; do not commit it.

## Local data

Sections, students, groups, and reviews are stored in `data/review-tracker.json` on this computer. The file is created when the first change is saved and is excluded from Git. Back it up regularly if you need to preserve your records. Removing it resets the local tracker.

To store the data file in another location, set `LOCAL_DATA_DIR` in the environment before starting the app. Relative paths are resolved from the project directory.

## Project scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest test suite |

## Technology

- React and TypeScript
- TanStack Start and TanStack Router
- Vite
- Tailwind CSS and Radix UI
- SheetJS (`xlsx`) for spreadsheet import and export
