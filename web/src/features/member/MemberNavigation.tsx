"use client";

import { BrandLogo, Button } from "../../components/ui";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isStaff, logout } from "../auth/session";
import { useSessionState } from "../auth/SessionProvider";
import styles from "./MemberNavigation.module.css";

const links = [
  { href: "/dashboard", label: "홈" },
  { href: "/notices", label: "공지" },
  { href: "/attendance", label: "내 출석" },
  { href: "/resources", label: "자료실" },
];

export function MemberNavigation() {
  const { session } = useSessionState();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

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
      <Link className={styles.brand} href="/dashboard" aria-label="전남대학교 합창단 홈">
        <BrandLogo priority />
      </Link>
      <nav className={styles.nav} aria-label="단원 메뉴">
        {links.map((link) => <Link key={link.href} href={link.href}
          aria-current={pathname === link.href || link.href === "/dashboard" && pathname.startsWith("/events/") ? "page" : undefined}>
          {link.label}
        </Link>)}
        {isStaff(session) && <Link href="/admin/events" aria-current={pathname.startsWith("/admin/") ? "page" : undefined}>운영진</Link>}
      </nav>
      <div className={styles.account}>
        {logoutError && <span className={styles.error} role="alert">{logoutError}</span>}
        {session?.name && <span>{session.name}</span>}
        <Button variant="ghost" size="small" type="button" onClick={handleLogout} disabled={loggingOut}>로그아웃</Button>
      </div>
    </div>
  </header>;
}
