import { CrudManager } from "@/components/admin/crud-manager";

export default function Page() {
  return <CrudManager config={{
    table: "subjects",
    title: "Exam Subjects",
    description: "Maintain the seven student portal subjects, including Previous Year Questions. Keep the subject names consistent with the student syllabus and question bank.",
    fields: [
      { key: "name_en", label: "Subject name (English)", required: true },
      { key: "name_hi", label: "Hindi name" },
      { key: "name_or", label: "Odia name" },
      { key: "is_active", label: "Active", type: "boolean" }
    ]
  }} />;
}
