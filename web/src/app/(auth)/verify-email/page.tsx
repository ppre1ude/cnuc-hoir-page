"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { verifyEmail } from "@/features/auth/registration";

export default function VerifyEmailPage() {
  const started = useRef(false);
  const [message, setMessage] = useState("이메일을 확인하고 있습니다.");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token) {
      queueMicrotask(() => setMessage("확인 링크가 올바르지 않습니다."));
      return;
    }
    verifyEmail(token)
      .then(() => setMessage("이메일 확인을 마쳤습니다. 운영진 승인을 기다려 주세요."))
      .catch(() => setMessage("확인 링크가 만료되었거나 이미 사용되었습니다."));
  }, []);

  return <main><h1>이메일 확인</h1><p role="status">{message}</p><Link href="/">처음으로</Link></main>;
}
