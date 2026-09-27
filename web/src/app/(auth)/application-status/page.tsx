"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../../lib/api";
import { getSession, type MemberSession } from "../../../features/auth/session";
import { resendVerification } from "../../../features/auth/registration";

export default function ApplicationStatusPage() {
  const router = useRouter();
  const [member, setMember] = useState<MemberSession | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSession().then(setMember).catch((error) => {
      if (error instanceof ApiRequestError && error.status === 401) router.replace("/login");
      else setMessage("상태를 불러오지 못했습니다.");
    });
  }, [router]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const email = String(new FormData(event.currentTarget).get("email") ?? "");
      await resendVerification(email);
      setMessage("주소가 확인되면 확인 메일을 보내드립니다.");
    } catch {
      setMessage("요청을 처리하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  const status = member?.status;
  return <main><h1>가입 신청 상태</h1>
    {status === "EMAIL_PENDING" && <><p>이메일 확인이 필요합니다.</p><form onSubmit={resend}>
      <label htmlFor="resend-email">이메일</label><input id="resend-email" name="email" type="email" required />
      <button type="submit">확인 메일 다시 요청</button></form></>}
    {status === "APPROVAL_PENDING" && <p>운영진 승인을 기다리고 있습니다.</p>}
    {status === "APPROVED" && <p>가입이 승인되었습니다. <Link href="/dashboard">회원 화면으로 이동</Link></p>}
    {status === "REJECTED" && <p>가입 신청이 반려되었습니다.</p>}
    {message && <p role="status">{message}</p>}
  </main>;
}
