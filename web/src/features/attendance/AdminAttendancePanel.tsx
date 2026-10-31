"use client";

import { Button, Input, Feedback, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { ApiRequestError } from "../../lib/api";
import { eventAudience, getEvent, type ChoirEvent, seoulDateTime, seoulTime } from "../event/events";
import {
  attendanceLabel, attendanceTone, closeCheckIn, correctAttendance, getAdminAttendance, getCheckInSession,
  openCheckIn, rotateCheckIn, type AdminAttendance, type IssuedSession, type SessionStatus,
} from "./attendance";

type Correction = "CHECKED_IN" | "LATE" | "MISSED";
const correctionLabel: Record<Correction, string> = { CHECKED_IN: "출석", LATE: "지각", MISSED: "미출석" };
import { rosterName } from "../member/roles";
import { rosterRowId, useListDetailFocus } from "../member/useListDetailFocus";
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
  const [selected, setSelected] = useState<number | null>(null);
  const focus = useListDetailFocus(selected);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // 열 수 있는 시각과 연습 종료를 넘겼는지는 이 값으로 판단합니다. 타이머가 그 시각에 맞춰 다시 그립니다.
  const [now, setNow] = useState(() => Date.now());

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
      setNow(Date.now());
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

  // 창이 닫혀 있으면 다음 경계(열 수 있는 시각, 연습 종료)에 다시 그려 버튼을 켜거나 숨깁니다.
  // 이미 지난 경계면 바로 그립니다. 세션 응답이 늦게 와서 now가 낡은 경우도 여기서 맞춰집니다.
  useEffect(() => {
    if (!session || session.open) return;
    const next = [session.opensAt, session.expiresAt]
      .map((value) => value ? new Date(value).getTime() : NaN).find((time) => time > now);
    if (next === undefined) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session, now]);
  const beforeOpen = session !== null && !session.open && new Date(session.opensAt).getTime() > now;
  // 연습이 끝나면 서버가 열기를 거절하므로 버튼 대신 정정을 안내합니다.
  const ended = session !== null && session.expiresAt !== null && new Date(session.expiresAt).getTime() <= now;

  async function correct(member: AdminAttendance, status: Correction) {
    const reason = reasons[member.memberId]?.trim();
    if (!reason) return;
    await action(async () => {
      await correctAttendance(eventId, member.memberId, status, reason);
      setReasons((value) => ({ ...value, [member.memberId]: "" }));
    });
  }

  const current = members?.find((member) => member.memberId === selected) ?? null;
  const statusLabel = (member: AdminAttendance) => member.status === "NOT_OPEN" && windowOpen ? "출석 전" : attendanceLabel[member.status];

  return <div className={styles.page}>
    <Link className={styles.back} href="/admin/events">← 일정 관리로 돌아가기</Link>
    <PageHeader title={`${event?.title ?? "일정"} 출석 관리`} />
    <p>출석 창은 연습 시작 30분 전부터 열 수 있고 연습이 끝나면 닫힙니다. 시작 15분 뒤부터 찍은 출석은 지각으로 기록됩니다. 재발급하면 이전 QR과 코드는 바로 쓸 수 없습니다.</p>
    {event && <p>출석 대상: <strong>{eventAudience(event)}</strong>. 출석 창을 닫거나 연습이 끝나면 출석하지 않은 대상 단원은 미출석으로 남습니다.</p>}
    {message && <Feedback tone="error">{message}</Feedback>}
    <div className={styles.grid}>{session && <section className={styles.panel} aria-label="출석 창">
      <div className={styles.panelHeader}><h2>출석 창</h2></div>
      <p>현재 창: {event?.cancelledAt ? "취소된 일정이라 출석 창을 열 수 없습니다. 이미 받은 기록은 그대로 볼 수 있습니다."
        : session.open ? `연습 끝 ${seoulDateTime(session.expiresAt!)}까지`
        : ended ? "연습이 끝나 출석 창을 열 수 없습니다. 늦게 온 단원은 아래에서 정정해 주세요."
        : beforeOpen ? `출석 창은 ${seoulDateTime(session.opensAt)}부터 열 수 있습니다.`
        : session.sessionId ? "출석 창이 닫혀 있습니다. 늦게 온 단원이 있으면 다시 열어 주세요." : "열려 있지 않음"}</p>
      <div className={styles.actions}>{!session.open && !ended && !event?.cancelledAt && <Button variant="primary" type="button" disabled={busy || beforeOpen} onClick={() => action(() => openCheckIn(eventId))}>
        {session.sessionId ? "다시 열기" : "출석 받기"}</Button>}
      {session.open && <><Button variant="secondary" type="button" disabled={busy} onClick={() => action(() => rotateCheckIn(eventId, session.sessionId!))}>QR과 코드 재발급</Button>
        <Button variant="danger" type="button" disabled={busy} onClick={() => action(async () => { await closeCheckIn(eventId); return null; })}>출석 창 닫기</Button></>}</div>
      {session.open && <div>
        <p>입력 코드: <strong className={styles.code}>{session.code}</strong></p>
        {issued && qrImage && <Image className={styles.qr} src={qrImage} width={280} height={280} unoptimized alt="현장 출석 QR 코드" />}
        <p>새로고침하면 QR은 사라지지만 코드는 그대로 보입니다. 명단은 15초마다 갱신되며, 바로 확인하려면 &apos;목록 다시 불러오기&apos;를 눌러 주세요.</p>
      </div>}
    </section>}
    </div>
    <section aria-label="단원 출석 기록" className={styles.memberSection}>
      <div className={styles.panelHeader}><h2>단원별 상태</h2>
        <Button variant="secondary" type="button" onClick={reloadList}>목록 다시 불러오기</Button></div>
      {members === null && !message && <SkeletonRows count={3} label="출석 기록을 불러오는 중입니다." />}
      {members?.length === 0 && <p>출석 대상 단원이 없습니다.</p>}
      {/* 계정 목록과 같은 꼴입니다. 왼쪽에 이름과 상태만 적은 목록, 오른쪽에 고른 단원의 기록과 정정 칸을 둡니다. */}
      {members && members.length > 0 && <div className={styles.workspace} data-view={current ? "detail" : "list"}>
        <div className={styles.roster}><ul className={styles.rosterList} aria-label="단원 목록">
          {members.map((member) => <li key={member.memberId}>
            <button type="button" id={rosterRowId(member.memberId)} className={styles.rosterRow} aria-current={selected === member.memberId ? "true" : undefined} onClick={() => setSelected(member.memberId)}>
              <strong>{rosterName(member)}</strong>
              <StatusBadge tone={attendanceTone(member.status)}>{statusLabel(member)}</StatusBadge>
            </button>
          </li>)}
        </ul></div>
        <div className={styles.detail} ref={focus.detail} tabIndex={-1}>
          <Button variant="secondary" size="small" type="button" className={styles.toList} onClick={() => { focus.leave(selected); setSelected(null); }}>목록으로</Button>
          {current ? <article>
            <div className={styles.rowHeader}>
              <h2>{rosterName(current)}</h2>
              <StatusBadge tone={attendanceTone(current.status)}>{statusLabel(current)}</StatusBadge>
              {current.checkedInAt && <span className={styles.time}>{seoulTime(current.checkedInAt)}</span>}
              {current.correctedAt && <span className={styles.time}>정정됨</span>}
            </div>
            {/* 이유를 적기 전에는 버튼을 꺼 둬, 화면 위쪽에 오류를 띄우지 않습니다. */}
            <div className={styles.fieldGroup}><label htmlFor={`reason-${current.memberId}`}>{current.name} 정정 이유</label> <Input id={`reason-${current.memberId}`}
              value={reasons[current.memberId] ?? ""} maxLength={500}
              onChange={(event) => setReasons((value) => ({ ...value, [current.memberId]: event.target.value }))} /></div>
            <div className={styles.actions}>{(Object.keys(correctionLabel) as Correction[]).map((status) => <Button key={status} variant="secondary" type="button"
              disabled={busy || !reasons[current.memberId]?.trim() || current.status === status}
              onClick={() => correct(current, status)}>{current.name} {correctionLabel[status]}으로 정정</Button>)}</div>
          </article> : <p className={styles.placeholder}>왼쪽 목록에서 단원을 고르면 출석 기록과 정정 칸이 나옵니다.</p>}
        </div>
      </div>}
    </section>
  </div>;
}
