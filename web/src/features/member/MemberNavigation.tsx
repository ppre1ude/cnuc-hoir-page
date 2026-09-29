"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession, logout, type MemberSession } from "../auth/session";
import styles from "./MemberNavigation.module.css";

const links = [
  { href: "/dashboard", label: "일정" },
  { href: "/notices", label: "공지" },
  { href: "/attendance", label: "내 출석" },
];

export function MemberNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<MemberSession | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;
    getSession().then((value) => {
      if (!active) return;
      if (value.status !== "APPROVED") { router.replace("/application-status"); return; }
      setSession(value);
    }).catch((error) => {
      if (active && error instanceof ApiRequestError && error.status === 401) router.replace("/login");
    });
    return () => { active = false; };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
      setLogoutError("로그아웃하지 못했습니다.");
    }
  }

  return <header className={styles.header}>
    <div className={styles.inner}>
      <Link className={styles.brand} href="/dashboard" aria-label="전남대학교 합창단 일정">
        <Image src="/images/choir-logo-horizontal.png" alt="전남대학교 합창단" width={280} height={61} priority />
      </Link>
      <nav className={styles.nav} aria-label="회원 메뉴">
        {links.map((link) => <Link key={link.href} href={link.href}
          aria-current={pathname === link.href || link.href === "/dashboard" && pathname.startsWith("/events/") ? "page" : undefined}>
          {link.label}
        </Link>)}
        {session?.admin && <Link href="/admin/events">운영진</Link>}
      </nav>
      <div className={styles.account}>
        {logoutError && <span className={styles.error} role="alert">{logoutError}</span>}
        {session?.name && <span>{session.name}</span>}
        <button type="button" onClick={handleLogout} disabled={loggingOut}>로그아웃</button>
      </div>
    </div>
  </header>;
}
