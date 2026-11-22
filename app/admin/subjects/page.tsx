import { CrudManager } from "@/components/admin/crud-manager";

export default function Page() {
  return <CrudManager config={{
    table: "subjects",
    title: "Exam Subjects",
    description: "Maintain the six approved Odisha Police exam subjects. Keep the subject names consistent with the student syllabus and question bank.",
    order: "sort_order",
    fields: [
      { key: "name_en", label: "Subject name (English)", required: true },
      { key: "name_hi", label: "Hindi name" },
      { key: "name_or", label: "Odia name" },
      { key: "sort_order", label: "Display order", type: "number" },
      { key: "is_active", label: "Active", type: "boolean" }
    ]
  }} />;
}
