"use client";

import { Feedback } from "../../../components/ui";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiRequestError } from "../../../lib/api";
import { GoogleButton } from "../../../features/auth/GoogleButton";
import { completeAccountSetup } from "../../../features/auth/session";

export default function ActivatePage() {
  const router = useRouter();
  const token = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const found = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (found && !token.current) token.current = found;
    if (found) window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => { setHasToken(Boolean(token.current)); setReady(true); });
  }, []);

  const connect = useCallback(async (credential: string) => {
    if (!token.current) return;
    setMessage("");
    try {
      const session = await completeAccountSetup(token.current, credential);
      token.current = null;
      router.replace(session.status === "APPROVED" ? "/dashboard" : "/application-status");
    } catch (caught) {
      if (caught instanceof ApiRequestError) setMessage(caught.message);
      else setMessage("계정을 연결하지 못했습니다. 다시 시도해 주세요.");
    }
  }, [router]);

  const fail = useCallback((value: string) => setMessage(value), []);

  return <>
    <h1>구글 계정 연결</h1>
    {ready && !hasToken && <Feedback tone="error">유효한 계정 연결 링크가 필요합니다. 운영진에게 요청해 주세요.</Feedback>}
    {ready && hasToken && <GoogleButton onCredential={connect} onError={fail} />}
    {message && <Feedback tone="error">{message}</Feedback>}
    <Link href="/login">로그인으로 돌아가기</Link>
  </>;
}
