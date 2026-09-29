"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApiRequestError } from "../../../lib/api";
import { completeAccountSetup } from "../../../features/auth/session";
import styles from "../simple.module.css";

export default function ActivatePage() {
  const token = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const found = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (found && !token.current) token.current = found;
    if (found) window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => { setHasToken(Boolean(token.current)); setReady(true); });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token.current) return;
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    if (password !== String(values.get("confirm") ?? "")) {
      setMessage("비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await completeAccountSetup(token.current, password);
      token.current = null;
      setHasToken(false);
      setCompleted(true);
      setMessage("비밀번호가 설정되었습니다. 로그인해 주세요.");
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "INVALID_INVITE_TOKEN") {
        setMessage("링크가 만료되었거나 이미 사용되었습니다. 운영진에게 새 링크를 요청해 주세요.");
      } else if (caught instanceof ApiRequestError && caught.code === "WEAK_PASSWORD") {
        setMessage("비밀번호는 12자 이상 입력해 주세요.");
      } else if (caught instanceof ApiRequestError && caught.code === "PASSWORD_TOO_LONG") {
        setMessage("비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.");
      } else {
        setMessage("비밀번호를 설정하지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
      <Image src="/images/choir-logo-horizontal.png" alt="" width={280} height={61} priority />
    </Link>
    <div className={styles.content}>
      <h1>계정 설정</h1>
      {ready && !hasToken && !completed && <p role="alert">유효한 계정 설정 링크가 필요합니다. 운영진에게 요청해 주세요.</p>}
      {ready && hasToken && !completed && <form className={styles.form} onSubmit={submit}>
        <label htmlFor="setup-password">새 비밀번호</label>
        <input id="setup-password" name="password" type="password" minLength={12} autoComplete="new-password" required />
        <label htmlFor="setup-confirm">비밀번호 확인</label>
        <input id="setup-confirm" name="confirm" type="password" minLength={12} autoComplete="new-password" required />
        <button type="submit" disabled={busy}>{busy ? "설정 중..." : "비밀번호 설정"}</button>
      </form>}
      {message && <p role={completed ? "status" : "alert"}>{message}</p>}
      <Link className={styles.home} href="/login">로그인으로 돌아가기</Link>
    </div>
  </main>;
}
