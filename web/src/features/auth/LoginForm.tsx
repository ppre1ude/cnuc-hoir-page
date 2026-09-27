"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession, login } from "./session";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await login(String(values.get("email") ?? ""), String(values.get("password") ?? ""));
      const member = await getSession();
      router.replace(member.status === "APPROVED" ? "/dashboard" : "/application-status");
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "RATE_LIMITED") {
        setError("로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError("이메일 또는 비밀번호를 확인해 주세요.");
      }
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit}>
    <label htmlFor="login-email">이메일</label>
    <input id="login-email" name="email" type="email" autoComplete="email" required />
    <label htmlFor="login-password">비밀번호</label>
    <input id="login-password" name="password" type="password" autoComplete="current-password" required />
    <button type="submit" disabled={pending}>{pending ? "로그인 중..." : "로그인"}</button>
    {error && <p role="alert">{error}</p>}
    <Link href="/reset-password">비밀번호 재설정</Link>
  </form>;
}
