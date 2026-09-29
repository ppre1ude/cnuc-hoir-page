"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { getSession, login } from "./session";
import styles from "./LoginForm.module.css";

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
      await getSession();
      router.replace("/dashboard");
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

  return <form className={styles.form} onSubmit={submit}>
    <div className={styles.field}>
      <label htmlFor="login-email">이메일</label>
      <input id="login-email" name="email" type="email" autoComplete="email" required />
    </div>
    <div className={styles.field}>
      <label htmlFor="login-password">비밀번호</label>
      <input id="login-password" name="password" type="password" autoComplete="current-password" required />
    </div>
    <button className={styles.submit} type="submit" disabled={pending}>{pending ? "로그인 중..." : "로그인"}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <p className={styles.help}>계정 발급이나 비밀번호 재설정은 운영진에게 요청해 주세요.</p>
  </form>;
}
