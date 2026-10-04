import type { ReactNode } from "react";
import { SessionProvider } from "../../features/auth/SessionProvider";
import { AdminNavigation } from "../../features/member/AdminNavigation";
import { MemberNavigation } from "../../features/member/MemberNavigation";
import styles from "./layout.module.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <SessionProvider requireStaff>
    <div className={styles.shell}>
      <MemberNavigation />
      <AdminNavigation />
      {children}
    </div>
  </SessionProvider>;
}
