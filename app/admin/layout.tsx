import { AdminGate } from "@/components/admin/admin-shell";
export default function AdminLayout({children}:{children:React.ReactNode}) { return <AdminGate>{children}</AdminGate>; }
