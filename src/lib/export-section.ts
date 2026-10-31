import type { Group, Student } from "@/lib/api.functions";
import { groupStatus, STATUS_LABEL } from "@/lib/status";

export async function downloadSectionWorkbook(
  sectionName: string,
  groups: Group[],
  students: Student[],
) {
  const XLSX = await import("xlsx");
  const reviewColumns = Array.from({ length: 5 }, (_, i) => {
    const number = i + 1;
    return [
      `Review ${number} Status`,
      `Review ${number} Date`,
      `Review ${number} Marks (out of 10)`,
      `Review ${number} Feedback`,
    ];
  }).flat();
  const headers = [
    "Section",
    "Group Number",
    "Project Title",
    "Member Names",
    "Member Roll Numbers",
    "Overall Status",
    "Reviews Completed (out of 5)",
    "Final Submitted",
    "Total Marks (out of 50)",
    "Average Marks per Scored Review",
    "Project Link",
    "GitHub Link",
    "Final Remarks",
    ...reviewColumns,
  ];

  const rows = groups.map((group) => {
    const reviews = Array.from({ length: 5 }, (_, i) => group.reviews.find((r) => r.review_no === i + 1));
    const completed = group.reviews.filter((r) => r.done).length;
    const scored = group.reviews.filter((r) => r.marks !== null);
    const total = scored.reduce((sum, review) => sum + (review.marks ?? 0), 0);
    const marks = scored.length ? Math.round((total + Number.EPSILON) * 100) / 100 : "";
    const average = scored.length ? Math.round((total / scored.length + Number.EPSILON) * 100) / 100 : "";

    return [
      sectionName,
      group.group_no,
      group.title,
      group.members.map((member) => member.name).join(", "),
      group.members.map((member) => member.roll_no).join(", "),
      STATUS_LABEL[groupStatus(completed, group.final_submitted)],
      completed,
      group.final_submitted ? "Yes" : "No",
      marks,
      average,
      group.project_link ?? "",
      group.github_link ?? "",
      group.final_remarks ?? "",
      ...reviews.flatMap((review) => [
        review ? (review.done ? "Done" : "Pending") : "",
        review?.done_date ?? "",
        review?.marks ?? "",
        review?.feedback ?? "",
      ]),
    ];
  });

  const groupSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  groupSheet["!autofilter"] = { ref: groupSheet["!ref"] ?? "A1" };
  groupSheet["!cols"] = headers.map((header, index) => {
    const longest = Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length));
    return { wch: Math.min(Math.max(longest + 2, 12), 48) };
  });

  const unassignedRows = students
    .filter((student) => !student.group_id)
    .map((student) => [student.roll_no, student.name]);
  const unassignedSheet = XLSX.utils.aoa_to_sheet([
    ["Roll Number", "Student Name"],
    ...unassignedRows,
  ]);
  unassignedSheet["!autofilter"] = { ref: unassignedSheet["!ref"] ?? "A1" };
  unassignedSheet["!cols"] = [{ wch: 20 }, { wch: 32 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, groupSheet, "Groups");
  XLSX.utils.book_append_sheet(workbook, unassignedSheet, "Unassigned Students");

  const date = new Date();
  const dateStamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const safeSectionName = sectionName.replace(/[\\/:*?"<>|]/g, "-").trim() || "Section";
  XLSX.writeFile(workbook, `${safeSectionName}-review-tracker-${dateStamp}.xlsx`);
}

export async function downloadAttendanceWorkbook(sectionName: string, groups: Group[], students: Student[]) {
  const XLSX = await import("xlsx");
  const memberships = new Map<string, { group: Group; memberId: string }>();
  for (const group of groups) {
    for (const member of group.members) memberships.set(member.id, { group, memberId: member.id });
  }
  const headers = ["Section", "Roll No", "Student Name", "Group No", "Total Attendance (out of 5)", "Attendance %"];
  const rows = [...students]
    .sort((a, b) => a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true, sensitivity: "base" }))
    .map((student) => {
      const membership = memberships.get(student.id);
      const total = membership
        ? membership.group.reviews.filter((review) => review.present_student_ids?.includes(student.id)).length
        : 0;
      return [sectionName, student.roll_no, student.name, membership?.group.group_no ?? "", total, `${Math.round(total / 5 * 100)}%`];
    });
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!autofilter"] = { ref: sheet["!ref"] ?? "A1" };
  sheet["!cols"] = [
    { wch: Math.max(14, sectionName.length + 2) }, { wch: 18 }, { wch: 30 },
    { wch: 12 }, { wch: 30 }, { wch: 16 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  const date = new Date();
  const dateStamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const safeSectionName = sectionName.replace(/[\\/:*?"<>|]/g, "-").trim() || "Section";
  XLSX.writeFile(workbook, `${safeSectionName}-attendance-${dateStamp}.xlsx`);
}
