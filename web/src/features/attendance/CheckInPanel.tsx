"use client";

import { Button, Input, Feedback, PageHeader, StatusBadge } from "../../components/ui";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiRequestError } from "../../lib/api";
import { getEventAttendance, memberAttendanceLabel, submitCheckIn, type AttendanceState } from "./attendance";
import styles from "./CheckInPanel.module.css";

export function CheckInPanel({ eventId }: { eventId: number }) {
  const [status, setStatus] = useState<AttendanceState | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [statusRefreshFailed, setStatusRefreshFailed] = useState(false);
  const [statusLoadFailed, setStatusLoadFailed] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const pendingQrToken = useRef<string | null>(null);
  const statusRequestVersion = useRef(0);
  const qrSubmissionInFlight = useRef(false);
  const completedRef = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    function processPending() {
      if (!pendingQrToken.current || qrSubmissionInFlight.current || completedRef.current) return;
      Promise.resolve().then(async () => {
        if (!alive || qrSubmissionInFlight.current || completedRef.current) return;
        const token = pendingQrToken.current;
        if (!token) return;
        pendingQrToken.current = null;
        qrSubmissionInFlight.current = true;
        setBusy(true);
        try {
          await submitCheckIn(eventId, token);
          if (!alive) return;
          completedRef.current = true;
          pendingQrToken.current = null;
          setCompleted(true);
        } catch (error) {
          if (alive) setMessage(errorMessage(error));
          try {
            const latest = await getEventAttendance(eventId);
            if (alive) setStatus(latest);
          } catch { /* 원래 출석 오류를 유지합니다. */ }
          return;
        } finally {
          if (alive) setBusy(false);
          qrSubmissionInFlight.current = false;
          if (alive && pendingQrToken.current && !completedRef.current) processPending();
        }
        if (alive) {
          try {
            const latest = await getEventAttendance(eventId);
            if (alive) { setStatus(latest); setStatusLoadFailed(false); setMessage("출석이 완료되었습니다."); }
          } catch {
            if (alive) {
              setStatusRefreshFailed(true);
              setMessage("출석은 완료됐지만 상태를 확인하지 못했습니다.");
            }
          }
        }
      });
    }
    function consumeHash() {
      const scanned = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (scanned) {
        pendingQrToken.current = scanned;
        statusRequestVersion.current++;
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      processPending();
      return Boolean(scanned || pendingQrToken.current);
    }
    window.addEventListener("hashchange", consumeHash);
    if (!consumeHash()) {
      const version = ++statusRequestVersion.current;
      getEventAttendance(eventId).then((value) => { if (alive && version === statusRequestVersion.current) setStatus(value); })
        .catch(() => { if (alive && version === statusRequestVersion.current) { setStatusLoadFailed(true); setMessage("출석 상태를 불러오지 못했습니다."); } });
    }
    return () => { alive = false; window.removeEventListener("hashchange", consumeHash); };
  }, [eventId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    statusRequestVersion.current++;
    setBusy(true);
    setMessage("");
    setCodeError(false);
    try {
      await submitCheckIn(eventId, code.trim().toUpperCase());
      completedRef.current = true;
      setCompleted(true);
      setCode("");
    } catch (error) {
      const invalid = error instanceof ApiRequestError && error.code === "INVALID_CREDENTIAL";
      setCodeError(invalid);
      setMessage(errorMessage(error));
      setBusy(false);
      // 틀린 코드는 지우지 않고 선택해 두어 바로 덮어 쓸 수 있게 합니다.
      if (invalid) { codeInput.current?.focus(); codeInput.current?.select(); }
      return;
    }
    try {
      setStatus(await getEventAttendance(eventId));
      setMessage("출석이 완료되었습니다.");
    } catch {
      setStatusRefreshFailed(true);
      setMessage("출석은 완료됐지만 상태를 확인하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function retryStatus() {
    if (busy) return;
    setBusy(true);
    statusRequestVersion.current++;
    try {
      setStatus(await getEventAttendance(eventId));
      setStatusLoadFailed(false);
      setStatusRefreshFailed(false);
      setStatusLoadFailed(false);
      setMessage(completed ? "출석이 완료되었습니다." : "");
    } catch { setMessage(completed ? "출석은 완료됐지만 상태를 확인하지 못했습니다." : "출석 상태를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  // 저장 중에 disabled를 걸면 엔터를 누른 입력 칸에서 초점이 빠지고 휴대폰 자판이 닫힙니다.
  // 그래서 저장 중에는 readOnly와 aria-disabled로 막고, disabled는 출석을 마친 뒤에만 겁니다.
  return <section aria-label="현장 출석" className={styles.panel}>
    <Link className={styles.backLink} href={`/events/${eventId}`}>← 일정</Link>
    <PageHeader title={status ? `${status.eventTitle} 출석` : "현장 출석"} />
    {status && <p className={styles.state}>현재 상태 <strong><StatusBadge tone={status.status === "CHECKED_IN" ? "positive" : status.status === "MISSED" ? "negative" : "neutral"}>{memberAttendanceLabel(status)}</StatusBadge></strong></p>}
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor="check-in-code">운영진이 알려준 출석 코드</label>
      <Input id="check-in-code" ref={codeInput} value={code} maxLength={8} autoComplete="off" enterKeyHint="go"
        name="code" required autoCapitalize="characters" spellCheck={false} aria-invalid={codeError || undefined}
        aria-describedby={codeError ? "check-in-feedback" : undefined}
        onChange={(event) => { setCode(event.target.value); if (codeError) setMessage(""); setCodeError(false); }}
        readOnly={busy} disabled={completed || status?.status === "CHECKED_IN"} />
      <Button variant="primary" size="large" type="submit" aria-disabled={busy || undefined}
        disabled={completed || !code.trim() || status?.status === "CHECKED_IN"}>
        {busy ? "확인 중..." : "출석하기"}
      </Button>
    </form>
    <div id="check-in-feedback">{message && <Feedback tone={completed && !statusRefreshFailed ? "success" : "error"}>{message}</Feedback>}</div>
    {(statusRefreshFailed || statusLoadFailed) && <Button variant="secondary" type="button" aria-disabled={busy || undefined} onClick={retryStatus}>상태 다시 확인</Button>}
  </section>;
}

function errorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) return "출석을 처리하지 못했습니다. 다시 시도해 주세요.";
  switch (error.code) {
    case "SESSION_CLOSED": return "출석 창이 닫혔거나 유효 시간이 지났습니다.";
    case "ALREADY_CHECKED_IN": return "이미 출석이 처리되었습니다.";
    case "NOT_ELIGIBLE": return "이 일정의 출석 대상이 아닙니다.";
    case "APPROVAL_REQUIRED": return "가입 승인 후 출석할 수 있습니다.";
    case "INVALID_CREDENTIAL": return "출석 코드를 확인해 주세요.";
    case "RATE_LIMITED": return "시도가 많습니다. 잠시 후 다시 시도해 주세요.";
    default: return error.message;
  }
}
