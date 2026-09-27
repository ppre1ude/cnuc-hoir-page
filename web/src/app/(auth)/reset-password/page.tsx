"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { confirmPasswordReset, requestPasswordReset } from "../../../features/auth/session";
import { ApiRequestError } from "../../../lib/api";

export default function ResetPasswordPage() {
  const token = useRef<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const discovered = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (discovered && !token.current) token.current = discovered;
    if (discovered) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    queueMicrotask(() => setHasToken(Boolean(token.current)));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      if (token.current) {
        await confirmPasswordReset(token.current, String(values.get("password") ?? ""));
        token.current = null;
        setMessage("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
      } else {
        await requestPasswordReset(String(values.get("email") ?? ""));
        setMessage("주소가 확인되면 재설정 메일을 보내드립니다.");
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "INVALID_RESET_TOKEN") setMessage("재설정 링크가 만료되었거나 이미 사용되었습니다.");
      else if (error instanceof ApiRequestError && error.code === "PASSWORD_TOO_LONG") setMessage("비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.");
      else setMessage("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  return <main><h1>비밀번호 재설정</h1><form onSubmit={submit}>
    {hasToken ? <><label htmlFor="reset-password">새 비밀번호</label>
      <input id="reset-password" name="password" type="password" minLength={12} autoComplete="new-password" required />
      <button type="submit">비밀번호 변경</button></>
      : <><label htmlFor="reset-email">이메일</label>
      <input id="reset-email" name="email" type="email" autoComplete="email" required />
      <button type="submit">재설정 메일 요청</button></>}
  </form>{message && <p role="status">{message}</p>}<Link href="/login">로그인</Link></main>;
}
