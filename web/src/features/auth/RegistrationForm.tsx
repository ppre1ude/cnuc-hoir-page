"use client";

import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { applyForMembership } from "./registration";
import styles from "./RegistrationForm.module.css";

export function RegistrationForm() {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError("");
    try {
      await applyForMembership({
        email: String(values.get("email") ?? ""),
        password: String(values.get("password") ?? ""),
        name: String(values.get("name") ?? ""),
      });
      setComplete(true);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "EMAIL_ALREADY_USED") {
        setError("이미 사용 중인 이메일입니다.");
      } else if (caught instanceof ApiRequestError && caught.code === "PASSWORD_TOO_LONG") {
        setError("비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.");
      } else {
        setError("가입 신청을 처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
      }
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return <p className={styles.complete} role="status">가입 신청을 접수했습니다. 확인 메일이 도착하면 이메일을 확인한 뒤 운영진 승인을 기다려 주세요.</p>;
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor="join-email">이메일</label>
      <input id="join-email" name="email" type="email" autoComplete="email" required maxLength={320} />
      <label htmlFor="join-name">이름</label>
      <input id="join-name" name="name" autoComplete="name" required maxLength={100} />
      <label htmlFor="join-password">비밀번호</label>
      <input id="join-password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      <button type="submit" disabled={pending}>{pending ? "신청 중..." : "가입 신청"}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  );
}
