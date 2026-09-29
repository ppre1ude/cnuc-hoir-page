import type { ReactNode } from "react";
import Link from "next/link";
import { MemberNavigation } from "../../features/member/MemberNavigation";
import styles from "./layout.module.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <MemberNavigation />
    <nav className={styles.adminNav} aria-label="운영진 메뉴">
      <div className={styles.adminNavInner}>
        <Link href="/admin/applications">가입 신청</Link>
        <Link href="/admin/notices">공지 관리</Link>
        <Link href="/admin/events">행사 관리</Link>
      </div>
    </nav>
    {children}
  </div>;
}
