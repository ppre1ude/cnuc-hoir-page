"use client";

import { Button, Feedback } from "../../../components/ui";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout, type MemberSession } from "../../../features/auth/session";
import styles from "../layout.module.css";

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

  return <>
    <h1>{session ? title : "계정 확인 중"}</h1>
    {session && <p>{session.name}님의 계정 상태입니다.</p>}
    {session?.email && <p>{session.email} 계정으로 로그인했습니다. 운영진에게 알려 준 구글 계정이 아니면 로그아웃한 뒤 그 계정으로 다시 로그인해 주세요.</p>}
    {session?.status === "APPROVAL_PENDING" && <>
      <p>Gmail이 아닌 주소로 만든 구글 계정은 자동 승인 명단에 있어도 운영진이 직접 승인해야 합니다. 오래 걸리면 운영진에게 로그인했다고 알려 주세요.</p>
      <p>운영진이 승인한 뒤 다시 로그인하면 결과를 확인할 수 있습니다.</p>
    </>}
    {session && <div className={styles.actions}>
      {session.status === "APPROVAL_PENDING" && <Button variant="secondary" type="button" onClick={signOut}>다시 로그인해 확인</Button>}
      <Button variant="secondary" type="button" onClick={signOut}>로그아웃</Button>
    </div>}
    {error && <Feedback tone="error">{error}</Feedback>}
  </>;
}
