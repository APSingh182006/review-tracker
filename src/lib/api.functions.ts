import { createServerFn } from "@tanstack/react-start";
import postgres from "postgres";
import { z } from "zod";

type Section = { id: string; name: string; created_at: string };
type StudentRecord = { id: string; section_id: string; roll_no: string; name: string };
type GroupRecord = {
  id: string;
  section_id: string;
  group_no: number;
  title: string;
  final_submitted: boolean;
  final_remarks: string | null;
  project_link: string | null;
  github_link: string | null;
};
type ReviewRecord = {
  id: string;
  group_id: string;
  review_no: number;
  done: boolean;
  done_date: string | null;
  marks: number | null;
  feedback: string | null;
  present_student_ids?: string[] | null;
};
type LocalState = {
  sections: Section[];
  students: StudentRecord[];
  groups: GroupRecord[];
  group_members: { group_id: string; student_id: string }[];
  reviews: ReviewRecord[];
};

let mutationQueue = Promise.resolve();
let postgresClient: ReturnType<typeof postgres> | undefined;
let postgresSchemaReady: Promise<void> | undefined;

function databaseUrl() {
  return process.env["DATABASE_URL"] || process.env["POSTGRES_URL"] || "";
}

function getPostgres() {
  if (!postgresClient) postgresClient = postgres(databaseUrl(), { max: 1, idle_timeout: 20, connect_timeout: 10 });
  return postgresClient;
}

async function ensurePostgresSchema() {
  if (!postgresSchemaReady) {
    postgresSchemaReady = (async () => {
      const sql = getPostgres();
      await sql`CREATE TABLE IF NOT EXISTS review_tracker_state (
        id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`INSERT INTO review_tracker_state (id, state) VALUES ('main', ${sql.json(emptyState())}) ON CONFLICT (id) DO NOTHING`;
    })();
  }
  await postgresSchemaReady;
}

async function dataPaths() {
  const { join, resolve } = await import("node:path");
  const dataDirectory = process.env["LOCAL_DATA_DIR"]
    ? resolve(process.env["LOCAL_DATA_DIR"]!)
    : join(process.cwd(), "data");
  return { dataDirectory, dataFile: join(dataDirectory, "review-tracker.json") };
}

function emptyState(): LocalState {
  return { sections: [], students: [], groups: [], group_members: [], reviews: [] };
}

async function readState(): Promise<LocalState> {
  if (process.env["VERCEL"] === "1" && !databaseUrl()) {
    throw new Error("Set DATABASE_URL or POSTGRES_URL in the Vercel project to enable persistent tracker storage");
  }
  if (databaseUrl()) {
    await ensurePostgresSchema();
    const [row] = await getPostgres()`SELECT state FROM review_tracker_state WHERE id = 'main'`;
    if (!row) throw new Error("Tracker database has not been initialized");
    return row["state"] as LocalState;
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const { dataFile } = await dataPaths();
    return JSON.parse(await readFile(dataFile, "utf8")) as LocalState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
}

async function mutateState<T>(mutate: (state: LocalState) => T | Promise<T>): Promise<T> {
  if (process.env["VERCEL"] === "1" && !databaseUrl()) {
    throw new Error("Set DATABASE_URL or POSTGRES_URL in the Vercel project to enable persistent tracker storage");
  }
  if (databaseUrl()) {
    await ensurePostgresSchema();
    return await getPostgres().begin<T>(async (tx) => {
      const [row] = await tx`SELECT state FROM review_tracker_state WHERE id = 'main' FOR UPDATE`;
      if (!row) throw new Error("Tracker database has not been initialized");
      const state = row["state"] as LocalState;
      const result = await mutate(state);
      await tx`UPDATE review_tracker_state SET state = ${tx.json(state)}, updated_at = NOW() WHERE id = 'main'`;
      return result;
    }) as T;
  }
  const previous = mutationQueue;
  let release!: () => void;
  mutationQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const state = await readState();
    const result = await mutate(state);
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dataDirectory, dataFile } = await dataPaths();
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
    return result;
  } finally {
    release();
  }
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tracker-session:${value}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function expectedPassword() {
  // Local-only default. Set TEACHER_PASSWORD in .env to choose a different one.
  return process.env["TEACHER_PASSWORD"] || "admin";
}

async function authorize(token: string) {
  if (!token || token !== await hash(expectedPassword())) throw new Error("UNAUTHORIZED");
}

function id() {
  return crypto.randomUUID();
}

const tokenSchema = z.object({ token: z.string() });
const optionalTokenSchema = z.object({ token: z.string().optional() });

export const login = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => z.object({ password: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => {
    const submitted = await hash(data.password);
    const expected = await hash(expectedPassword());
    let difference = 0;
    for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ submitted.charCodeAt(index);
    return difference === 0 ? { ok: true as const, token: expected } : { ok: false as const, token: "" };
  });

export const verifyToken = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => tokenSchema.parse(data))
  .handler(async ({ data }) => ({ ok: data.token === await hash(expectedPassword()) }));

export const listSections = createServerFn({ method: "POST" })
  .validator((data: { token?: string }) => optionalTokenSchema.parse(data))
  .handler(async () => (await readState()).sections.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(({ id, name }) => ({ id, name })));

export const createSection = createServerFn({ method: "POST" })
  .validator((data: { token: string; name: string }) => tokenSchema.extend({ name: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const section = { id: id(), name: data.name, created_at: new Date().toISOString() };
      state.sections.push(section);
      return { id: section.id, name: section.name };
    });
  });

export const renameSection = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; name: string }) => tokenSchema.extend({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const section = state.sections.find((item) => item.id === data.id);
      if (!section) throw new Error("Section not found");
      section.name = data.name;
      return { ok: true };
    });
  });

export const deleteSection = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => tokenSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const groupIds = new Set(state.groups.filter((group) => group.section_id === data.id).map((group) => group.id));
      const studentIds = new Set(state.students.filter((student) => student.section_id === data.id).map((student) => student.id));
      state.sections = state.sections.filter((section) => section.id !== data.id);
      state.students = state.students.filter((student) => student.section_id !== data.id);
      state.groups = state.groups.filter((group) => group.section_id !== data.id);
      state.group_members = state.group_members.filter((member) => !groupIds.has(member.group_id) && !studentIds.has(member.student_id));
      state.reviews = state.reviews.filter((review) => !groupIds.has(review.group_id));
      return { ok: true };
    });
  });

export type Review = { id: string; review_no: number; done: boolean; done_date: string | null; marks: number | null; feedback: string | null; present_student_ids: string[] | null };
export type Student = { id: string; roll_no: string; name: string; group_id: string | null };
export type Group = {
  id: string; group_no: number; title: string; final_submitted: boolean; final_remarks: string | null;
  project_link: string | null; github_link: string | null;
  members: { id: string; roll_no: string; name: string }[]; reviews: Review[];
};
export type SectionWorkbookPayload = {
  students: { roll_no: string; name: string }[];
  groups: {
    group_no: number; title: string; final_submitted: boolean; final_remarks: string | null;
    project_link: string | null; github_link: string | null;
    members: { roll_no: string; name: string }[];
    reviews: {
      review_no: number; done: boolean; done_date: string | null; marks: number | null;
      feedback: string | null; present_roll_nos: string[] | null;
    }[];
  }[];
};

export const getSectionData = createServerFn({ method: "POST" })
  .validator((data: { token?: string; sectionId: string }) => optionalTokenSchema.extend({ sectionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const state = await readState();
    const sectionStudents = state.students.filter((student) => student.section_id === data.sectionId);
    const sectionGroups = state.groups.filter((group) => group.section_id === data.sectionId).sort((a, b) => a.group_no - b.group_no);
    const assigned = new Map<string, string>();
    const groups: Group[] = sectionGroups.map((group) => {
      const members = state.group_members
        .filter((member) => member.group_id === group.id)
        .map((member) => sectionStudents.find((student) => student.id === member.student_id))
        .filter((student): student is StudentRecord => !!student)
        .sort((a, b) => a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }));
      members.forEach((member) => assigned.set(member.id, group.id));
      return {
        id: group.id,
        group_no: group.group_no,
        title: group.title,
        final_submitted: group.final_submitted,
        final_remarks: group.final_remarks,
        project_link: group.project_link,
        github_link: group.github_link,
        members: members.map(({ id, roll_no, name }) => ({ id, roll_no, name })),
        reviews: state.reviews.filter((review) => review.group_id === group.id)
          .sort((a, b) => a.review_no - b.review_no)
          .map(({ group_id: _groupId, ...review }) => ({ ...review, present_student_ids: review.present_student_ids ?? null })),
      };
    });
    const students: Student[] = sectionStudents
      .map((student) => ({ ...student, group_id: assigned.get(student.id) ?? null }))
      .sort((a, b) => a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }));
    return { students, groups };
  });

export const importStudents = createServerFn({ method: "POST" })
  .validator((data: { token: string; sectionId: string; rows: { roll_no: string; name: string }[] }) => tokenSchema.extend({
    sectionId: z.string().uuid(),
    rows: z.array(z.object({ roll_no: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(120) })).max(2000),
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      if (!state.sections.some((section) => section.id === data.sectionId)) throw new Error("Section not found");
      const deduped = new Map(data.rows.map((row) => [row.roll_no, row]));
      for (const row of deduped.values()) {
        const existing = state.students.find((student) => student.section_id === data.sectionId && student.roll_no === row.roll_no);
        if (existing) existing.name = row.name;
        else state.students.push({ id: id(), section_id: data.sectionId, ...row });
      }
      return { count: deduped.size };
    });
  });

export const importSectionWorkbook = createServerFn({ method: "POST" })
  .validator((data: { token: string; sectionId: string; payload: SectionWorkbookPayload }) => tokenSchema.extend({
    sectionId: z.string().uuid(),
    payload: z.object({
      students: z.array(z.object({
        roll_no: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(120),
      })).max(2000),
      groups: z.array(z.object({
        group_no: z.number().int().min(1).max(10000),
        title: z.string().trim().min(1).max(200),
        final_submitted: z.boolean(),
        final_remarks: z.string().max(2000).nullable(),
        project_link: z.string().max(500).nullable().refine((value) => !value || /^https?:\/\//i.test(value), "Project links must start with http(s)://"),
        github_link: z.string().max(500).nullable().refine((value) => !value || /^https?:\/\//i.test(value), "GitHub links must start with http(s)://"),
        members: z.array(z.object({
          roll_no: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(120),
        })).min(1).max(50),
        reviews: z.array(z.object({
          review_no: z.number().int().min(1).max(5), done: z.boolean(),
          done_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
          marks: z.number().min(0).max(10).nullable(), feedback: z.string().max(2000).nullable(),
          present_roll_nos: z.array(z.string().min(1).max(50)).max(50).nullable(),
        })).length(5),
      })).max(500),
    }),
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      if (!state.sections.some((section) => section.id === data.sectionId)) throw new Error("Section not found");
      if (state.students.some((student) => student.section_id === data.sectionId) ||
          state.groups.some((group) => group.section_id === data.sectionId)) {
        throw new Error("Import is only available in an empty section. Create a new section or choose an empty one.");
      }

      const studentsByRoll = new Map<string, StudentRecord>();
      for (const student of data.payload.students) {
        if (studentsByRoll.has(student.roll_no)) throw new Error(`Duplicate roll number ${student.roll_no} in workbook`);
        const record: StudentRecord = { id: id(), section_id: data.sectionId, ...student };
        studentsByRoll.set(student.roll_no, record);
        state.students.push(record);
      }

      const groupNumbers = new Set<number>();
      const assignedRolls = new Set<string>();
      for (const imported of data.payload.groups) {
        if (groupNumbers.has(imported.group_no)) throw new Error(`Duplicate group number ${imported.group_no} in workbook`);
        groupNumbers.add(imported.group_no);
        const memberRecords = imported.members.map((member) => {
          const record = studentsByRoll.get(member.roll_no);
          if (!record || record.name !== member.name) throw new Error(`Student ${member.roll_no} is missing or inconsistent in the workbook`);
          if (assignedRolls.has(member.roll_no)) throw new Error(`Student ${member.roll_no} appears in more than one group`);
          assignedRolls.add(member.roll_no);
          return record;
        });
        const memberIds = new Set(memberRecords.map((member) => member.id));
        const reviewNumbers = new Set(imported.reviews.map((review) => review.review_no));
        if (reviewNumbers.size !== 5) throw new Error(`Group ${imported.group_no} must have Reviews 1–5`);
        for (const review of imported.reviews) {
          if (review.present_roll_nos?.some((rollNo) => !imported.members.some((member) => member.roll_no === rollNo))) {
            throw new Error(`Review ${review.review_no} attendance includes a student outside Group ${imported.group_no}`);
          }
        }

        const groupId = id();
        state.groups.push({
          id: groupId, section_id: data.sectionId, group_no: imported.group_no, title: imported.title,
          final_submitted: imported.final_submitted, final_remarks: imported.final_remarks,
          project_link: imported.project_link, github_link: imported.github_link,
        });
        state.group_members.push(...memberRecords.map((member) => ({ group_id: groupId, student_id: member.id })));
        state.reviews.push(...imported.reviews.map((review) => ({
          id: id(), group_id: groupId, review_no: review.review_no, done: review.done,
          done_date: review.done_date, marks: review.marks, feedback: review.feedback,
          present_student_ids: review.present_roll_nos === null ? null : [...new Set(review.present_roll_nos.map((rollNo) => {
            const member = studentsByRoll.get(rollNo);
            if (!member || !memberIds.has(member.id)) throw new Error(`Student ${rollNo} is not in Group ${imported.group_no}`);
            return member.id;
          }))],
        })));
      }
      return { groups: data.payload.groups.length, students: data.payload.students.length };
    });
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => tokenSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      state.students = state.students.filter((student) => student.id !== data.id);
      state.group_members = state.group_members.filter((member) => member.student_id !== data.id);
      return { ok: true };
    });
  });

export const saveGroup = createServerFn({ method: "POST" })
  .validator((data: { token: string; sectionId: string; groupId?: string | undefined; title: string; studentIds: string[] }) => tokenSchema.extend({
    sectionId: z.string().uuid(), groupId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200), studentIds: z.array(z.string().uuid()).min(1).max(50),
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const selectedIds = [...new Set(data.studentIds)];
      const inSection = new Set(state.students.filter((student) => student.section_id === data.sectionId).map((student) => student.id));
      if (selectedIds.some((studentId) => !inSection.has(studentId))) throw new Error("Some students are not in this section");
      const existingGroup = data.groupId ? state.groups.find((group) => group.id === data.groupId && group.section_id === data.sectionId) : undefined;
      if (data.groupId && !existingGroup) throw new Error("Group not found");
      const conflicts = state.group_members.filter((member) => selectedIds.includes(member.student_id) && member.group_id !== data.groupId);
      if (conflicts.length) throw new Error("A selected student is already in another group");

      let group = existingGroup;
      if (group) {
        group.title = data.title;
        state.group_members = state.group_members.filter((member) => member.group_id !== group!.id);
      } else {
        const groupNo = Math.max(0, ...state.groups.filter((item) => item.section_id === data.sectionId).map((item) => item.group_no)) + 1;
        group = {
          id: id(), section_id: data.sectionId, group_no: groupNo, title: data.title,
          final_submitted: false, final_remarks: null, project_link: null, github_link: null,
        };
        state.groups.push(group);
        for (let reviewNo = 1; reviewNo <= 5; reviewNo++) {
          state.reviews.push({ id: id(), group_id: group.id, review_no: reviewNo, done: false, done_date: null, marks: null, feedback: null });
        }
      }
      state.group_members.push(...selectedIds.map((studentId) => ({ group_id: group!.id, student_id: studentId })));
      return { id: group.id };
    });
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => tokenSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      state.groups = state.groups.filter((group) => group.id !== data.id);
      state.group_members = state.group_members.filter((member) => member.group_id !== data.id);
      state.reviews = state.reviews.filter((review) => review.group_id !== data.id);
      return { ok: true };
    });
  });

export const updateReview = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; done: boolean; done_date: string | null; marks: number | null; feedback: string | null }) => tokenSchema.extend({
    id: z.string().uuid(), done: z.boolean(), done_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    marks: z.number().min(0).max(10).nullable(), feedback: z.string().max(2000).nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const review = state.reviews.find((item) => item.id === data.id);
      if (!review) throw new Error("Review not found");
      review.done = data.done;
      review.done_date = data.done_date;
      review.marks = data.marks;
      review.feedback = data.feedback;
      return { ok: true };
    });
  });

export const updateAttendance = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; present_student_ids: string[] }) => tokenSchema.extend({
    id: z.string().uuid(), present_student_ids: z.array(z.string().uuid()).max(50),
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const review = state.reviews.find((item) => item.id === data.id);
      if (!review) throw new Error("Review not found");
      const groupStudentIds = new Set(state.group_members.filter((member) => member.group_id === review.group_id).map((member) => member.student_id));
      const presentIds = [...new Set(data.present_student_ids)];
      if (presentIds.some((studentId) => !groupStudentIds.has(studentId))) throw new Error("Attendance includes a student outside this group");
      review.present_student_ids = presentIds;
      return { ok: true };
    });
  });

export const updateFinal = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; final_submitted: boolean; final_remarks: string | null }) => tokenSchema.extend({
    id: z.string().uuid(), final_submitted: z.boolean(), final_remarks: z.string().max(2000).nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const group = state.groups.find((item) => item.id === data.id);
      if (!group) throw new Error("Group not found");
      group.final_submitted = data.final_submitted;
      group.final_remarks = data.final_remarks;
      return { ok: true };
    });
  });

const httpUrl = z.string().trim().max(500).url().refine((value) => /^https?:\/\//i.test(value), "Must start with http(s)://").nullable();
export const updateLinks = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; project_link: string | null; github_link: string | null }) => tokenSchema.extend({
    id: z.string().uuid(), project_link: httpUrl, github_link: httpUrl,
  }).parse(data))
  .handler(async ({ data }) => {
    await authorize(data.token);
    return mutateState((state) => {
      const group = state.groups.find((item) => item.id === data.id);
      if (!group) throw new Error("Group not found");
      group.project_link = data.project_link;
      group.github_link = data.github_link;
      return { ok: true };
    });
  });
