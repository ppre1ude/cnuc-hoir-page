"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { verifyEmail } from "../../../features/auth/registration";
import { ApiRequestError } from "../../../lib/api";

export default function VerifyEmailPage() {
  const started = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<"loading" | "retry" | "invalid" | "success" | "missing">("loading");

  async function attemptVerification() {
    const token = tokenRef.current;
    if (!token) return;
    setState("loading");
    try {
      await verifyEmail(token);
      tokenRef.current = null;
      setState("success");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409 && error.code === "INVALID_VERIFICATION_TOKEN") {
        tokenRef.current = null;
        setState("invalid");
      } else {
        setState("retry");
      }
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token) {
      queueMicrotask(() => setState("missing"));
      return;
    }
    tokenRef.current = token;
    queueMicrotask(() => void attemptVerification());
  }, []);

  const messages = {
    loading: "이메일을 확인하고 있습니다.",
    retry: "일시적으로 확인하지 못했습니다. 다시 시도해 주세요.",
    invalid: "확인 링크가 만료되었거나 이미 사용되었습니다.",
    success: "이메일 확인을 마쳤습니다. 운영진 승인을 기다려 주세요.",
    missing: "확인 링크가 올바르지 않습니다.",
  };

  return <main><h1>이메일 확인</h1><p role="status">{messages[state]}</p>
    {state === "retry" && <button type="button" onClick={() => void attemptVerification()}>다시 시도</button>}
    <Link href="/">처음으로</Link></main>;
}
