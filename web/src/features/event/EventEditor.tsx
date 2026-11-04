"use client";

import { Button, Input, Select, Textarea, Feedback, PageHeader, ActionLink, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { canManageEvent, canManageRoster, type Part } from "../auth/session";
import { useSession } from "../auth/SessionProvider";
import { partLabel, parts } from "../member/roles";
import { ApiRequestError } from "../../lib/api";
import { cancelEvent, createEvent, deleteEvent, eventKindText, getEvents, monthBounds, restoreEvent, scheduleKindLabel, seoulDateKey, seoulTime, type ChoirEvent,
  scheduleKinds, type ScheduleKind, updateEvent } from "./events";
import styles from "./EventEditor.module.css";
import calendarStyles from "./EventCalendar.module.css";
import { EventBatchCreator } from "./EventBatchCreator";
import { AdminEventRsvps } from "./AdminEventRsvps";
import { eventKind } from "./EventKind";
import { localInput, openPicker, utcInput } from "./eventTime";

// 목록과 상세에 쓰는 "9월 20일 (일)" 모양입니다.
function seoulDayLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(value));
}



export function EventEditor() {
  const session = useSession();
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const currentMonth = useRef(month);
  const listRequestVersion = useRef(0);
  const [events, setEvents] = useState<ChoirEvent[] | null>(null);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<ChoirEvent | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [kind, setKind] = useState<ScheduleKind>("EVENT");
  const [part, setPart] = useState<Part | null>(null);
  const [obEligible, setObEligible] = useState(false);
  const [publicVisible, setPublicVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    // 월 입력을 지우면 ""가 들어옵니다. 그대로 조회하면 날짜 계산이 예외를 내 화면 전체가 멈춥니다.
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    let alive = true;
    const requestVersion = ++listRequestVersion.current;
    const { from, to } = monthBounds(month);
    getEvents(from, to).then((result) => {
      if (alive && listRequestVersion.current === requestVersion && currentMonth.current === month) {
        setEvents(result); setLoadedMonth(month); setListError("");
      }
    }).catch(() => {
      if (!alive || listRequestVersion.current !== requestVersion || currentMonth.current !== month) return;
      setListError("일정 목록을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [month, retry]);

  function clear() {
    setSelected(null); setTitle(""); setDescription(""); setStartAt(""); setEndAt("");
    setKind("EVENT"); setPart(null); setObEligible(false); setPublicVisible(false);
  }

  function edit(event: ChoirEvent) {
    setSelected(event); setTitle(event.title); setDescription(event.description);
    setStartAt(localInput(event.startAt)); setEndAt(localInput(event.endAt));
    setKind(event.kind); setPart(event.part); setObEligible(event.obEligible); setPublicVisible(event.publicVisible);
    setError(""); setSaved("");
  }

  async function save(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (busy) return;
    const start = utcInput(startAt);
    const end = utcInput(endAt);
    if (!start || !end || start >= end) { setError("일정 시작과 종료 시각을 확인해 주세요."); return; }
    setBusy(true); setError(""); setSaved("");
    try {
      const input = { title: title.trim(), description, startAt: start, endAt: end, kind,
        part: kind === "PART_REHEARSAL" ? part : null, obEligible, publicVisible };
      if (selected) await updateEvent(selected.id, input);
      else await createEvent(input);
      clear(); setSaved("일정을 저장했습니다.");
    } catch {
      setError("일정을 저장하지 못했습니다."); setBusy(false); return;
    }
    await reloadAfterChange();
  }

  // 취소와 되돌리기는 상세를 연 채로 바뀐 상태를 보여 주고, 삭제하면 상세를 닫습니다.
  async function changeStatus(operation: () => Promise<ChoirEvent | void>, done: string, failed: string) {
    if (busy) return;
    setBusy(true); setError(""); setSaved("");
    try {
      const updated = await operation();
      if (updated) edit(updated);
      else clear();
      setSaved(done);
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.status === 409 ? caught.message : failed);
      setBusy(false); return;
    }
    await reloadAfterChange();
  }

  function confirmCancel(event: ChoirEvent) {
    if (!window.confirm(`${seoulDayLabel(event.startAt)} ${event.title} 일정을 취소할까요? 단원 달력에 취소됨으로 표시되고, 참석 응답과 출석을 더 받지 않으며, 열려 있는 출석 창도 닫힙니다. 이미 받은 기록은 그대로 남습니다.`)) return;
    void changeStatus(() => cancelEvent(event.id), "일정을 취소했습니다.", "일정을 취소하지 못했습니다.");
  }

  function confirmDelete(event: ChoirEvent) {
    if (!window.confirm(`${seoulDayLabel(event.startAt)} ${event.title} 일정을 완전히 삭제할까요? 받은 참석 응답도 함께 지워지고, 되돌릴 수 없습니다.`)) return;
    void changeStatus(() => deleteEvent(event.id), "일정을 삭제했습니다.", "일정을 삭제하지 못했습니다.");
  }

  async function reloadAfterChange() {
    const refreshMonth = currentMonth.current;
    const refreshVersion = ++listRequestVersion.current;
    try {
      const { from, to } = monthBounds(refreshMonth);
      const refreshed = await getEvents(from, to);
      if (currentMonth.current !== refreshMonth || listRequestVersion.current !== refreshVersion) return;
      setEvents(refreshed); setLoadedMonth(refreshMonth); setListError("");
    } catch {
      if (currentMonth.current === refreshMonth && listRequestVersion.current === refreshVersion) {
        setEvents(null); setListError("변경은 완료됐지만 목록을 새로고침하지 못했습니다.");
      }
    } finally { setBusy(false); }
  }

  const validMonth = /^\d{4}-\d{2}$/.test(month);
  // 고칠 수 있거나 응답 집계·출석을 관리할 수 있는 일정만 보입니다. 다른 파트 수석에게는 남의 파트연습이 빠집니다.
  const visible = loadedMonth === month && !listError
    ? events?.filter((event) => canManageEvent(session, event.kind, event.part) || canManageRoster(session, event)) ?? null : null;
  // 고칠 수 없는 일정(예: 총무가 보는 전체연습)은 출석 관리와 응답 집계만 씁니다.
  const editable = selected !== null && canManageEvent(session, selected.kind, selected.part);
  const partChoices = parts.filter((item) => canManageEvent(session, "PART_REHEARSAL", item) || (kind === "PART_REHEARSAL" && item === part));
  const kindChoices = scheduleKinds.filter((item) => item === kind
    || (item === "PART_REHEARSAL" ? partChoices.length > 0 : canManageEvent(session, item, null)));
  function refreshList(createdMonth: string) {
    currentMonth.current = createdMonth;
    setMonth(createdMonth);
    setLoadedMonth("");
    setRetry((value) => value + 1);
  }
  return <div className={styles.page}>
    <PageHeader title="일정 관리" actions={<ActionLink variant="secondary" href="/dashboard">홈으로 가기</ActionLink>} />
    {listError && <Feedback tone="error">{listError} <Button variant="secondary" type="button" onClick={() => { setListError(""); setRetry(retry + 1); }}>다시 시도</Button></Feedback>}
    {saved && <p role="status">{saved}</p>}
    <EventBatchCreator onCreated={refreshList} />
    <section className={styles.section} aria-labelledby="list-title">
      <h2 id="list-title">등록된 일정</h2>
      {/* 단원 명단과 같은 틀입니다. 왼쪽 좁은 칸에 월과 일정 목록, 오른쪽에 고른 일정의 수정 폼과 응답 집계를 둡니다. */}
      <div className={styles.workspace} data-view={selected ? "detail" : "list"}>
        <div className={styles.roster}>
          <label htmlFor="list-month">조회 월</label>
          <Input id="list-month" type="month" value={month} onChange={(change) => { currentMonth.current = change.target.value; setMonth(change.target.value); setLoadedMonth(""); }} />
          {!validMonth && <p>조회할 월을 골라 주세요.</p>}
          {validMonth && !visible && !listError && <SkeletonRows count={5} label="일정을 불러오는 중입니다." />}
          {visible?.length === 0 && <p>이번 달 등록된 일정이 없습니다.</p>}
          <ul className={styles.rosterList} aria-label="일정 목록">
            {visible?.map((event) => <li key={event.id}>
              <button type="button" className={styles.rosterRow} aria-current={selected?.id === event.id ? "true" : undefined} onClick={() => edit(event)}>
                <strong className={event.cancelledAt ? calendarStyles.cancelled : undefined}>{event.title}</strong><span>{seoulDayLabel(event.startAt)}</span>
                <small>{event.cancelledAt && "취소됨 "}{eventKindText(event) !== event.title && `${eventKindText(event)} `}{seoulTime(event.startAt)}</small>
              </button>
            </li>)}
          </ul>
        </div>
        <div className={styles.detail}>
          <Button variant="secondary" size="small" type="button" className={styles.toList} onClick={clear}>목록으로</Button>
          {!selected && <p className={styles.placeholder}>목록에서 일정을 선택하세요.</p>}
          {selected && <>
        <div className={styles.detailHeader}>
          <h3>{selected.title}</h3>
          <span className={`${calendarStyles.kind} ${calendarStyles.kindBadge}`} data-kind={eventKind(selected)}>{eventKindText(selected)}</span>
          {selected.cancelledAt && <StatusBadge tone="neutral">취소됨</StatusBadge>}
        </div>
        {/* 여러 날에 걸친 일정은 끝나는 날짜도 적습니다. */}
        <p className={styles.when}>{seoulDayLabel(selected.startAt)} {seoulTime(selected.startAt)} ~ {seoulDayLabel(selected.endAt) !== seoulDayLabel(selected.startAt) && `${seoulDayLabel(selected.endAt)} `}{seoulTime(selected.endAt)}</p>
        {selected.createdBy && <p className={styles.when}>등록한 사람: {selected.createdBy}</p>}
        <p><Link href={`/admin/events/${selected.id}/attendance`}>이 일정 출석 관리</Link></p>
        {error && <Feedback tone="error">{error}</Feedback>}
        <form onSubmit={save} className={styles.form}>
          {!editable && <p className={styles.hint}>이 일정은 고칠 권한이 없습니다. 출석 관리와 응답 집계만 볼 수 있습니다.</p>}
          <label htmlFor="event-kind">종류</label><Select id="event-kind" value={kind} onChange={(change) => {
            const next = change.target.value as ScheduleKind;
            setKind(next); if (next === "PART_REHEARSAL" && !part) setPart(partChoices[0] ?? null);
          }}>{kindChoices.map((item) => <option key={item} value={item}>{scheduleKindLabel[item]}</option>)}</Select>
          {kind === "PART_REHEARSAL" && <><label htmlFor="event-part">파트</label><Select id="event-part" value={part ?? ""}
            onChange={(change) => setPart(change.target.value as Part)}>
            {partChoices.map((item) => <option key={item} value={item}>{partLabel[item]}</option>)}</Select></>}
          <label htmlFor="event-title">제목</label><Input id="event-title" value={title} onChange={(change) => setTitle(change.target.value)} maxLength={200} required />
          <label htmlFor="event-description">내용 (선택)</label><Textarea id="event-description" value={description} onChange={(change) => setDescription(change.target.value)} maxLength={10000} rows={7} />
          <label htmlFor="event-start">시작 시각 (한국 시간)</label><Input id="event-start" type="datetime-local" value={startAt} min="2000-01-01T00:00" step={300} onClick={(change) => openPicker(change.currentTarget)} onChange={(change) => setStartAt(change.target.value)} required />
          <label htmlFor="event-end">종료 시각 (한국 시간)</label><Input id="event-end" type="datetime-local" value={endAt} min="2000-01-01T00:00" step={300} onClick={(change) => openPicker(change.currentTarget)} onChange={(change) => setEndAt(change.target.value)} required />
          <label className={styles.check}><Input type="checkbox" checked={obEligible} onChange={(change) => setObEligible(change.target.checked)} /> OB도 참여 대상</label>
          <div className={styles.actions}>{editable && <Button variant="primary" type="submit" disabled={busy || !title.trim()}>{busy ? "저장 중..." : "저장"}</Button>}
            <Button variant="secondary" type="button" onClick={clear}>닫기</Button></div>
        </form>
        {editable && <div className={styles.actions}>
          {!selected.cancelledAt && <Button variant="danger" type="button" disabled={busy} onClick={() => confirmCancel(selected)}>이 일정 취소하기</Button>}
          {selected.cancelledAt && <>
            <Button variant="secondary" type="button" disabled={busy} onClick={() => void changeStatus(() => restoreEvent(selected.id), "일정 취소를 되돌렸습니다. 닫힌 출석 창은 필요하면 다시 열어 주세요.", "취소를 되돌리지 못했습니다.")}>취소 되돌리기</Button>
            <Button variant="danger" type="button" disabled={busy} onClick={() => confirmDelete(selected)}>완전히 삭제</Button>
          </>}
        </div>}
        {selected.cancelledAt && <p className={styles.hint}>단원에게 취소됨으로 보입니다. 출석 기록이 있는 일정은 삭제할 수 없고, 기록은 그대로 남습니다.</p>}
        <AdminEventRsvps key={selected.id} eventId={selected.id} />
          </>}
        </div>
      </div>
    </section>
  </div>;
}
