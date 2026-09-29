"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../../lib/api";
import { getSession, type MemberSession } from "../../../features/auth/session";
import { resendVerification } from "../../../features/auth/registration";
import styles from "../simple.module.css";

export default function ApplicationStatusPage() {
  const router = useRouter();
  const [member, setMember] = useState<MemberSession | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSession().then(setMember).catch((error) => {
      if (error instanceof ApiRequestError && error.status === 401) router.replace("/login");
      else setMessage("상태를 불러오지 못했습니다.");
    });
  }, [router]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const email = String(new FormData(event.currentTarget).get("email") ?? "");
      await resendVerification(email);
      setMessage("주소가 확인되면 확인 메일을 보내드립니다.");
    } catch {
      setMessage("요청을 처리하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const status = member?.status;
  return <main className={styles.page}>
    <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
      <Image src="/images/choir-logo-horizontal.png" alt="" width={280} height={61} priority />
    </Link>
    <div className={styles.content}><h1>가입 신청 상태</h1>
    {!member && !message && <p role="status">상태를 불러오는 중입니다.</p>}
    {status === "EMAIL_PENDING" && <><p className={styles.status}>이메일 확인이 필요합니다.</p><form className={styles.form} onSubmit={resend}>
      <label htmlFor="resend-email">이메일</label><input id="resend-email" name="email" type="email" required />
      <button type="submit" disabled={busy}>{busy ? "요청 중..." : "확인 메일 다시 요청"}</button></form></>}
    {status === "APPROVAL_PENDING" && <p className={styles.status}>운영진 승인을 기다리고 있습니다.</p>}
    {status === "APPROVED" && <p className={styles.status}>가입이 승인되었습니다. <Link href="/dashboard">회원 화면으로 이동</Link></p>}
    {status === "REJECTED" && <p className={styles.status}>가입 신청이 반려되었습니다.</p>}
    {status === "REVOKED" && <p className={styles.status}>회원 접근이 해제되었습니다.</p>}
    {message && <p role="status">{message}</p>}
    <Link className={styles.home} href="/">합창단 홈으로</Link></div>
  </main>;
}
