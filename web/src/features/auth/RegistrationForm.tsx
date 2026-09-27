"use client";

import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { applyForMembership } from "./registration";

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
      } else {
        setError("가입 신청을 처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
      }
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return <p role="status">확인 메일을 보냈습니다. 이메일을 확인한 뒤 운영진 승인을 기다려 주세요.</p>;
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="join-email">이메일</label>
      <input id="join-email" name="email" type="email" autoComplete="email" required maxLength={320} />
      <label htmlFor="join-name">이름</label>
      <input id="join-name" name="name" autoComplete="name" required maxLength={100} />
      <label htmlFor="join-password">비밀번호</label>
      <input id="join-password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      <button type="submit" disabled={pending}>{pending ? "신청 중..." : "가입 신청"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
