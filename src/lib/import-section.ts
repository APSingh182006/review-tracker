import type { SectionWorkbookPayload } from "@/lib/api.functions";

type CellRow = Record<string, unknown>;

function key(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readRows(XLSX: typeof import("xlsx"), sheet: import("xlsx").WorkSheet | undefined): CellRow[] {
  if (!sheet) return [];
  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (!values.length) return [];
  const headers = (values[0] ?? []).map((value) => key(String(value ?? "")));
  return values.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown, label: string) {
  const parsed = Number(text(value));
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`);
  return parsed;
}

function truthy(value: unknown) {
  return ["yes", "true", "done", "completed", "1"].includes(text(value).toLowerCase());
}

function presentRolls(value: unknown) {
  return text(value).split(/[;,]/).map((roll) => roll.trim()).filter(Boolean);
}

export async function parseSectionWorkbook(file: File): Promise<SectionWorkbookPayload> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheet = (name: string) => workbook.SheetNames.find((candidate) => key(candidate) === key(name));
  const groupsSheetName = sheet("Groups") ?? workbook.SheetNames[0];
  const groupRows = readRows(XLSX, groupsSheetName ? workbook.Sheets[groupsSheetName] : undefined)
    .filter((row) => text(row["groupnumber"] ?? row["groupno"]));
  const memberRows = readRows(XLSX, sheet("Group Members") ? workbook.Sheets[sheet("Group Members")!] : undefined);
  const unassignedRows = readRows(XLSX, sheet("Unassigned Students") ? workbook.Sheets[sheet("Unassigned Students")!] : undefined);

  const membersByGroup = new Map<number, { roll_no: string; name: string }[]>();
  for (const row of memberRows) {
    const groupNo = number(row["groupnumber"] ?? row["groupno"], "Group Number");
    const rollNo = text(row["rollnumber"] ?? row["rollno"]);
    const name = text(row["studentname"] ?? row["name"]);
    if (!rollNo || !name) continue;
    membersByGroup.set(groupNo, [...(membersByGroup.get(groupNo) ?? []), { roll_no: rollNo, name }]);
  }

  const groups: SectionWorkbookPayload["groups"] = groupRows.map((row) => {
    const groupNo = number(row["groupnumber"] ?? row["groupno"], "Group Number");
    const normalizedMembers = membersByGroup.get(groupNo);
    const legacyRolls = text(row["memberrollnumbers"]).split(/[;,]/).map((roll) => roll.trim()).filter(Boolean);
    const legacyNames = text(row["membernames"]).split(/[;,]/).map((name) => name.trim()).filter(Boolean);
    const members = normalizedMembers?.length
      ? normalizedMembers
      : legacyRolls.map((roll_no, index) => ({ roll_no, name: legacyNames[index] ?? "" })).filter((member) => member.name);
    if (!members.length) throw new Error(`Group ${groupNo} has no members in this workbook.`);

    const reviews = Array.from({ length: 5 }, (_, index) => {
      const n = index + 1;
      const markedKey = key(`Review ${n} Attendance Marked`);
      const presentKey = key(`Review ${n} Present Roll Numbers`);
      const hasAttendanceColumns = markedKey in row || presentKey in row;
      const attendanceMarked = hasAttendanceColumns && truthy(row[markedKey]);
      const rawMarks = text(row[key(`Review ${n} Marks (out of 10)`)]);
      const rawDate = text(row[key(`Review ${n} Date`)]);
      return {
        review_no: n,
        done: truthy(row[key(`Review ${n} Status`)]),
        done_date: rawDate || null,
        marks: rawMarks ? number(rawMarks, `Review ${n} Marks`) : null,
        feedback: text(row[key(`Review ${n} Feedback`)]) || null,
        present_roll_nos: attendanceMarked ? presentRolls(row[presentKey]) : null,
      };
    });

    return {
      group_no: groupNo,
      title: text(row["projecttitle"]) || `Group ${groupNo}`,
      final_submitted: truthy(row["finalsubmitted"]),
      final_remarks: text(row["finalremarks"]) || null,
      project_link: text(row["projectlink"]) || null,
      github_link: text(row["githublink"]) || null,
      members,
      reviews,
    };
  });

  const studentsByRoll = new Map<string, { roll_no: string; name: string }>();
  const addStudent = (rollNo: string, name: string) => {
    if (!rollNo || !name) return;
    const existing = studentsByRoll.get(rollNo);
    if (existing && existing.name !== name) throw new Error(`Roll number ${rollNo} has conflicting student names.`);
    studentsByRoll.set(rollNo, { roll_no: rollNo, name });
  };
  groups.forEach((group) => group.members.forEach((member) => addStudent(member.roll_no, member.name)));
  unassignedRows.forEach((row) => addStudent(
    text(row["rollnumber"] ?? row["rollno"]),
    text(row["studentname"] ?? row["name"]),
  ));

  if (!groups.length && !studentsByRoll.size) throw new Error("No groups or students found. Choose a Review Tracker group export workbook.");
  if (studentsByRoll.size > 2000) throw new Error("This workbook contains more than 2,000 students.");
  return { students: [...studentsByRoll.values()], groups };
}
