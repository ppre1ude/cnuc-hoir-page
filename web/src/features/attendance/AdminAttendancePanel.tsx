"use client";

import { Button, Input, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { ApiRequestError } from "../../lib/api";
import { getEvent, type ChoirEvent, seoulDateTime } from "../event/events";
import {
  attendanceLabel, closeCheckIn, correctAttendance, getAdminAttendance, getCheckInSession,
  openCheckIn, rotateCheckIn, type AdminAttendance, type IssuedSession, type SessionStatus,
} from "./attendance";
import { rosterName } from "../member/roles";
import styles from "../member/AdminPages.module.css";

// 서버 시계가 조금 늦으면 유효 시간이 지난 창을 아직 열림으로 답하므로, 이미 지난 창은 닫힌 것으로 봅니다.
function closedIfExpired(session: SessionStatus): SessionStatus {
  return session.open && session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()
    ? { ...session, open: false } : session;
}

export function AdminAttendancePanel({ eventId }: { eventId: number }) {
  const [event, setEvent] = useState<ChoirEvent | null>(null);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [issued, setIssued] = useState<IssuedSession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [members, setMembers] = useState<AdminAttendance[] | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // 15초 갱신, 버튼, 동작 뒤 갱신이 겹칠 수 있어 가장 나중에 보낸 요청의 응답만 화면에 씁니다.
  // 화면에 쓰지 않은 응답이면 false를 돌려줘 호출한 쪽이 안내 문구를 건드리지 않게 합니다.
  const latestLoad = useRef(0);
  const refresh = useCallback(async () => {
    const load = ++latestLoad.current;
    try {
      const [current, rows] = await Promise.all([getCheckInSession(eventId), getAdminAttendance(eventId)]);
      if (load !== latestLoad.current) return false;
      setSession(closedIfExpired(current));
      setMembers(rows);
      return true;
    } catch (error) {
      if (load === latestLoad.current) throw error;
      return false;
    }
  }, [eventId]);

  useEffect(() => {
    let alive = true;
    const load = ++latestLoad.current;
    Promise.all([getEvent(eventId), getCheckInSession(eventId), getAdminAttendance(eventId)])
      .then(([eventResult, sessionResult, rows]) => {
        if (!alive) return;
        setEvent(eventResult);
        if (load !== latestLoad.current) return;
        setSession(closedIfExpired(sessionResult)); setMembers(rows);
      }).catch((error) => {
        if (alive && load === latestLoad.current) setMessage(error instanceof Error ? error.message : "출석 정보를 불러오지 못했습니다.");
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
    // 명단 요청이 늦어져도 지난 QR과 코드가 남지 않게 먼저 닫고, 서버 상태는 뒤이어 맞춥니다.
    const timer = window.setTimeout(() => {
      setSession((value) => value && { ...value, open: false });
      refresh().catch(() => undefined);
    }, Math.max(0, new Date(session.expiresAt).getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session, refresh]);

  const windowOpen = session?.open ?? false;
  useEffect(() => {
    if (!windowOpen) return;
    // 느린 연결에서 요청이 쌓여 서로를 무효로 만들지 않게, 이전 요청이 끝난 뒤에 다음 요청을 잡습니다.
    let stopped = false;
    let timer = window.setTimeout(function poll() {
      refresh().catch(() => undefined).finally(() => { if (!stopped) timer = window.setTimeout(poll, 15000); });
    }, 15000);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [windowOpen, refresh]);

  function reloadList() {
    refresh().then((applied) => { if (applied) setMessage(""); })
      .catch(() => setMessage("출석 목록을 새로고침하지 못했습니다."));
  }

  async function action(operation: () => Promise<IssuedSession | null | void>) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await operation();
      if (result !== undefined) {
        setQrImage("");
        setIssued(result);
        setSession((current) => result ? { sessionId: result.sessionId, expiresAt: result.expiresAt, open: true, code: result.code, opensAt: current?.opensAt ?? result.expiresAt }
          : { sessionId: null, expiresAt: null, open: false, code: null, opensAt: current?.opensAt ?? "" });
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
    if (!reason) return;
    await action(async () => {
      await correctAttendance(eventId, member.memberId, status, reason);
      setReasons((value) => ({ ...value, [member.memberId]: "" }));
    });
  }

  return <div className={styles.page}>
    <Link className={styles.back} href="/admin/events">← 일정 관리로 돌아가기</Link>
    <PageHeader title={`${event?.title ?? "일정"} 출석 관리`} />
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
        <strong>{rosterName(member)}</strong> <StatusBadge tone={member.status === "CHECKED_IN" ? "positive" : member.status === "MISSED" ? "negative" : "neutral"}>
          {member.status === "NOT_OPEN" && windowOpen ? "출석 전" : attendanceLabel[member.status]}</StatusBadge>
        {/* 정정은 드물게 쓰므로 접어 둡니다. 이유를 적기 전에는 버튼을 꺼 둬, 화면 위쪽에 오류를 띄우지 않습니다. */}
        <details className={styles.more}>
          <summary aria-label={`${member.name} 정정`}>정정</summary>
          <div className={styles.fieldGroup}><label htmlFor={`reason-${member.memberId}`}>{member.name} 정정 이유</label> <Input id={`reason-${member.memberId}`}
            value={reasons[member.memberId] ?? ""} maxLength={500}
            onChange={(event) => setReasons((value) => ({ ...value, [member.memberId]: event.target.value }))} /></div>
          <div className={styles.actions}><Button variant="secondary" type="button" disabled={busy || !reasons[member.memberId]?.trim() || member.status === "CHECKED_IN"}
            onClick={() => correct(member, "CHECKED_IN")}>{member.name} 출석으로 정정</Button>
          <Button variant="secondary" type="button" disabled={busy || !reasons[member.memberId]?.trim() || member.status === "MISSED"}
            onClick={() => correct(member, "MISSED")}>{member.name} 미출석으로 정정</Button></div>
        </details>
      </div>)}
    </section></div>
  </div>;
}
