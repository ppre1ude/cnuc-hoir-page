"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MemberNavigation.module.css";

const links = [
  { href: "/admin/members", label: "단원 계정" },
  { href: "/admin/applications", label: "가입 승인" },
  { href: "/admin/notices", label: "공지 관리" },
  { href: "/admin/events", label: "행사 관리" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return <nav className={styles.subnav} aria-label="운영진 메뉴">
    <div className={styles.subnavInner}>{links.map(({ href, label }) => <Link key={href} href={href}
      aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}</div>
  </nav>;
}
