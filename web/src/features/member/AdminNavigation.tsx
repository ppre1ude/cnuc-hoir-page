"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, getSession, type MemberSession, type Permission } from "../auth/session";
import styles from "./MemberNavigation.module.css";

const links: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin/members", label: "단원 계정", permission: "VIEW_MEMBERS" },
  { href: "/admin/applications", label: "가입 승인", permission: "APPROVE_APPLICATIONS" },
  { href: "/admin/notices", label: "공지 관리", permission: "MANAGE_EVENTS" },
  { href: "/admin/events", label: "행사 관리", permission: "MANAGE_EVENTS" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const [session, setSession] = useState<MemberSession | null>(null);

  useEffect(() => {
    let active = true;
    getSession().then((value) => { if (active) setSession(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return <nav className={styles.subnav} aria-label="운영진 메뉴">
    <div className={styles.subnavInner}>{links.filter((link) => can(session, link.permission)).map(({ href, label }) => <Link key={href} href={href}
      aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}</div>
  </nav>;
}
