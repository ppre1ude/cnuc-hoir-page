"use client";

import { Button, Input, Feedback, PageHeader, SkeletonRows } from "../../components/ui";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { ApiRequestError } from "../../lib/api";
import { getEvent, type ChoirEvent, seoulDateTime } from "../event/events";
import {
  attendanceLabel, closeCheckIn, correctAttendance, getAdminAttendance, getCheckInSession,
  openCheckIn, rotateCheckIn, type AdminAttendance, type IssuedSession, type SessionStatus,
} from "./attendance";
import styles from "../member/AdminPages.module.css";

export function AdminAttendancePanel({ eventId }: { eventId: number }) {
  const [event, setEvent] = useState<ChoirEvent | null>(null);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [issued, setIssued] = useState<IssuedSession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [members, setMembers] = useState<AdminAttendance[] | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [current, rows] = await Promise.all([getCheckInSession(eventId), getAdminAttendance(eventId)]);
    setSession(current);
    setMembers(rows);
  }, [eventId]);

  useEffect(() => {
    let alive = true;
    Promise.all([getEvent(eventId), getCheckInSession(eventId), getAdminAttendance(eventId)])
      .then(([eventResult, sessionResult, rows]) => {
        if (!alive) return;
        setEvent(eventResult); setSession(sessionResult); setMembers(rows);
      }).catch((error) => {
        if (alive) setMessage(error instanceof Error ? error.message : "출석 정보를 불러오지 못했습니다.");
      });
    return () => { alive = false; };
  }, [eventId]);

  useEffect(() => {
    if (!issued) return;
    let alive = true;
    const absolute = new URL(issued.qrUrl, window.location.origin).toString();
    QRCode.toDataURL(absolute, { errorCorrectionLevel: "M", margin: 2, width: 280 })
      .then((data) => { if (alive) setQrImage(data); })
      .catch(() => { if (alive) setMessage("QR 이미지를 만들지 못했습니다. 입력 코드를 사용해 주세요."); });
    return () => { alive = false; };
  }, [issued]);

  useEffect(() => {
    if (!session?.open || !session.expiresAt) return;
    // 서버 시계가 조금 늦어 아직 열림으로 답하면 1초 뒤 다시 묻습니다.
    const delay = Math.max(1000, new Date(session.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => {
      refresh().catch(() => setSession((value) => value && { ...value, open: false }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session, refresh]);

  const windowOpen = session?.open ?? false;
  useEffect(() => {
    if (!windowOpen) return;
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 15000);
    return () => window.clearInterval(timer);
  }, [windowOpen, refresh]);

  function reloadList() {
    refresh().then(() => setMessage("")).catch(() => setMessage("출석 목록을 새로고침하지 못했습니다."));
  }

  async function action(operation: () => Promise<IssuedSession | null | void>) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await operation();
      if (result !== undefined) {
        setQrImage("");
        setIssued(result);
        setSession(result ? { sessionId: result.sessionId, expiresAt: result.expiresAt, open: true }
          : { sessionId: null, expiresAt: null, open: false });
      }
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : "요청을 처리하지 못했습니다.");
      await refresh().catch(() => undefined);
      setBusy(false);
      return;
    }
    try { await refresh(); }
    catch { setMessage("변경은 완료됐지만 출석 목록을 새로고침하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function correct(member: AdminAttendance, status: "CHECKED_IN" | "MISSED") {
    const reason = reasons[member.memberId]?.trim();
    if (!reason) { setMessage("정정 이유를 입력해 주세요."); return; }
    await action(async () => {
      await correctAttendance(eventId, member.memberId, status, reason);
      setReasons((value) => ({ ...value, [member.memberId]: "" }));
    });
  }

  return <div className={styles.page}>
    <Link className={styles.back} href="/admin/events">← 행사 관리로 돌아가기</Link>
    <PageHeader title={`${event?.title ?? "행사"} 출석 관리`} />
    <p>출석 창은 열 때부터 10분 동안 유효합니다. 회전하면 이전 QR과 코드는 즉시 사용할 수 없습니다.</p>
    <p><strong>파트연습에는 출석 창을 열지 마세요.</strong> 지금은 파트를 구분하지 않아, 출석 창을 닫거나 유효 시간이 지나면 출석하지 않은 대상 단원 모두가 미출석으로 남습니다.</p>
    {message && <Feedback tone="error">{message}</Feedback>}
    <div className={styles.grid}>{session && <section className={styles.panel} aria-label="출석 창">
      <div className={styles.panelHeader}><h2>출석 창</h2></div>
      <p>현재 창: {session.open ? `${seoulDateTime(session.expiresAt!)}까지 유효`
        : session.sessionId ? "유효 시간이 지났습니다. 늦게 온 단원이 있으면 출석 창을 다시 열어 주세요." : "열려 있지 않음"}</p>
      <div className={styles.actions}>{!session.open && <Button variant="primary" type="button" disabled={busy} onClick={() => action(() => openCheckIn(eventId))}>출석 창 열기</Button>}
      {session.open && <><Button variant="secondary" type="button" disabled={busy} onClick={() => action(() => rotateCheckIn(eventId, session.sessionId!))}>QR과 코드 재발급</Button>
        <Button variant="danger" type="button" disabled={busy} onClick={() => action(async () => { await closeCheckIn(eventId); return null; })}>출석 창 닫기</Button></>}</div>
      {issued && session.open && <div>
        <p>입력 코드: <strong className={styles.code}>{issued.code}</strong></p>
        {qrImage && <Image className={styles.qr} src={qrImage} width={280} height={280} unoptimized alt="현장 출석 QR 코드" />}
        <p>페이지를 새로고침하면 QR과 코드가 사라집니다. 명단은 15초마다 갱신되며, 바로 확인하려면 &apos;목록 다시 불러오기&apos;를 눌러 주세요.</p>
      </div>}
    </section>}
    <section className={styles.panel} aria-label="단원 출석 기록">
      <div className={styles.panelHeader}><h2>단원별 상태</h2>
        <Button variant="secondary" type="button" onClick={reloadList}>목록 다시 불러오기</Button></div>
      {members === null && !message && <SkeletonRows count={3} label="출석 기록을 불러오는 중입니다." />}
      {members?.length === 0 && <p>출석 대상 단원이 없습니다.</p>}
      {members?.map((member) => <div className={styles.row} key={member.memberId}>
        <strong>{member.name}</strong> <span>{member.email}</span> · {attendanceLabel[member.status]}
        <div className={styles.fieldGroup}><label htmlFor={`reason-${member.memberId}`}>정정 이유</label> <Input id={`reason-${member.memberId}`}
          value={reasons[member.memberId] ?? ""} maxLength={500}
          onChange={(event) => setReasons((value) => ({ ...value, [member.memberId]: event.target.value }))} /></div>
        <div className={styles.actions}><Button variant="primary" type="button" disabled={busy || member.status === "CHECKED_IN"}
          onClick={() => correct(member, "CHECKED_IN")}>출석으로 정정</Button>
        <Button variant="secondary" type="button" disabled={busy || member.status === "MISSED"}
          onClick={() => correct(member, "MISSED")}>미출석으로 정정</Button></div>
      </div>)}
    </section></div>
  </div>;
}
