"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getSession, logout, type MemberSession } from "../../../features/auth/session";
import styles from "../simple.module.css";

export default function ApplicationStatusPage() {
  const router = useRouter();
  const [session, setSession] = useState<MemberSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSession().then((value) => {
      if (!active) return;
      if (value.status === "APPROVED") router.replace("/dashboard");
      else setSession(value);
    }).catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    try { await logout(); router.replace("/login"); }
    catch { setError("로그아웃하지 못했습니다."); }
  }

  const title = session?.status === "REJECTED" ? "가입 신청이 반려되었습니다"
    : session?.status === "INVITED" ? "계정 연결이 필요합니다" : "가입 승인 대기 중입니다";

  return <main className={styles.page}>
    <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
      <Image src="/images/choir-logo-horizontal.png" alt="" width={280} height={61} priority />
    </Link>
    <div className={styles.content}>
      <h1>{session ? title : "계정 확인 중"}</h1>
      {session && <p className={styles.status}>{session.name}님의 계정 상태입니다.</p>}
      {session?.status === "APPROVAL_PENDING" && <button type="button" onClick={() => window.location.reload()}>상태 다시 확인</button>}
      {session && <button type="button" onClick={signOut}>로그아웃</button>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  </main>;
}
