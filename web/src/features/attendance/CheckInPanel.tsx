"use client";

import { Button, Input, Feedback, PageHeader } from "../../components/ui";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiRequestError } from "../../lib/api";
import { attendanceLabel, getEventAttendance, submitCheckIn, type AttendanceState } from "./attendance";
import styles from "./CheckInPanel.module.css";

export function CheckInPanel({ eventId }: { eventId: number }) {
  const [status, setStatus] = useState<AttendanceState | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [statusRefreshFailed, setStatusRefreshFailed] = useState(false);
  const pendingQrToken = useRef<string | null>(null);
  const statusRequestVersion = useRef(0);
  const qrSubmissionInFlight = useRef(false);
  const completedRef = useRef(false);

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
            if (alive) { setStatus(latest); setMessage("출석이 완료되었습니다."); }
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
        .catch(() => { if (alive && version === statusRequestVersion.current) setMessage("출석 상태를 불러오지 못했습니다."); });
    }
    return () => { alive = false; window.removeEventListener("hashchange", consumeHash); };
  }, [eventId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    statusRequestVersion.current++;
    setBusy(true);
    setMessage("");
    try {
      await submitCheckIn(eventId, code.trim().toUpperCase());
      completedRef.current = true;
      setCompleted(true);
      setCode("");
    } catch (error) {
      setMessage(errorMessage(error));
      setBusy(false);
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
    try {
      setStatus(await getEventAttendance(eventId));
      setStatusRefreshFailed(false);
      setMessage("출석이 완료되었습니다.");
    } catch { setMessage("출석은 완료됐지만 상태를 확인하지 못했습니다."); }
  }

  return <section aria-label="현장 출석" className={styles.panel}>
    <PageHeader title="현장 출석" />
    {status && <p>현재 상태: <strong>{attendanceLabel[status.status]}</strong></p>}
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor="check-in-code">운영진이 알려준 출석 코드</label>
      <Input id="check-in-code" value={code} maxLength={8} autoComplete="off"
        onChange={(event) => setCode(event.target.value)} disabled={busy || completed || status?.status === "CHECKED_IN"} />
      <Button variant="primary" type="submit" disabled={busy || completed || !code.trim() || status?.status === "CHECKED_IN"}>
        {busy ? "확인 중..." : "출석하기"}
      </Button>
    </form>
    {message && <Feedback tone={completed && !statusRefreshFailed ? "success" : "error"}>{message}</Feedback>}
    {statusRefreshFailed && <Button variant="secondary" type="button" onClick={retryStatus}>상태 다시 확인</Button>}
    <p><Link href={`/events/${eventId}`}>행사로 돌아가기</Link></p>
  </section>;
}

function errorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) return "출석을 처리하지 못했습니다. 다시 시도해 주세요.";
  switch (error.code) {
    case "SESSION_CLOSED": return "출석 창이 닫혔거나 유효 시간이 지났습니다.";
    case "ALREADY_CHECKED_IN": return "이미 출석이 처리되었습니다.";
    case "NOT_ELIGIBLE": return "이 행사의 출석 대상이 아닙니다.";
    case "APPROVAL_REQUIRED": return "가입 승인 후 출석할 수 있습니다.";
    case "INVALID_CREDENTIAL": return "출석 코드를 확인해 주세요.";
    case "RATE_LIMITED": return "시도가 많습니다. 잠시 후 다시 시도해 주세요.";
    default: return error.message;
  }
}
