"use client";

import { Button, Input, Select, Textarea, Feedback, PageHeader, ActionLink, SkeletonRows } from "../../components/ui";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { canManageEvent, canManageRoster, type Part } from "../auth/session";
import { useSession } from "../auth/SessionProvider";
import { partLabel, parts } from "../member/roles";
import { createEvent, eventKindText, getEvents, monthBounds, scheduleKindLabel, seoulDateKey, seoulDateTime, type ChoirEvent,
  scheduleKinds, type ScheduleKind, updateEvent } from "./events";
import styles from "./EventEditor.module.css";
import { EventBatchCreator } from "./EventBatchCreator";
import { AdminEventRsvps } from "./AdminEventRsvps";

function localInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function utcInput(value: string) {
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
  const [saved, setSaved] = useState(false);

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
    setError(""); setSaved(false);
  }

  async function save(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (busy) return;
    const start = utcInput(startAt);
    const end = utcInput(endAt);
    if (!start || !end || start >= end) { setError("일정 시작과 종료 시각을 확인해 주세요."); return; }
    setBusy(true); setError(""); setSaved(false);
    try {
      const input = { title: title.trim(), description, startAt: start, endAt: end, kind,
        part: kind === "PART_REHEARSAL" ? part : null, obEligible, publicVisible };
      if (selected) await updateEvent(selected.id, input);
      else await createEvent(input);
      clear(); setSaved(true);
    } catch {
      setError("일정을 저장하지 못했습니다."); setBusy(false); return;
    }
    const refreshMonth = currentMonth.current;
    const refreshVersion = ++listRequestVersion.current;
    try {
      const { from, to } = monthBounds(refreshMonth);
      const refreshed = await getEvents(from, to);
      if (currentMonth.current !== refreshMonth || listRequestVersion.current !== refreshVersion) return;
      setEvents(refreshed); setLoadedMonth(refreshMonth); setListError("");
    } catch {
      if (currentMonth.current === refreshMonth && listRequestVersion.current === refreshVersion) {
        setEvents(null); setListError("일정은 저장됐지만 목록을 새로고침하지 못했습니다.");
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
    <PageHeader title="일정 관리" actions={<ActionLink variant="secondary" href="/events">일정으로 가기</ActionLink>} />
    {listError && <Feedback tone="error">{listError} <Button variant="secondary" type="button" onClick={() => { setListError(""); setRetry(retry + 1); }}>다시 시도</Button></Feedback>}
    {saved && <p role="status">일정을 저장했습니다.</p>}
    <EventBatchCreator onCreated={refreshList} />
    <div className={`${styles.grid} ${!selected ? styles.singleColumn : ""}`}>
      <section className={styles.card}>
        <div className={styles.listHeader}><h2>{validMonth ? `${month.replace("-", "년 ")}월 일정` : "일정"}</h2>
          <label>조회 월 <Input type="month" value={month} onChange={(change) => { currentMonth.current = change.target.value; setMonth(change.target.value); setLoadedMonth(""); }} /></label>
        </div>
        {!validMonth && <p>조회할 월을 골라 주세요.</p>}
        {validMonth && !visible && !listError && <SkeletonRows count={5} label="일정을 불러오는 중입니다." />}
        {visible?.length === 0 && <p>이번 달 등록된 일정이 없습니다.</p>}
        {visible?.map((event) => <Button variant="unstyled" type="button" key={event.id} className={styles.eventRow} aria-pressed={selected?.id === event.id} onClick={() => edit(event)}>
          <strong>{event.title}</strong><span>{eventKindText(event)} · {seoulDateTime(event.startAt)}</span><span aria-hidden="true" className={styles.arrow}>→</span>
        </Button>)}
      </section>
      {selected && <section className={styles.card}>
        <h2>일정 수정</h2>
        {selected && <p><Link href={`/admin/events/${selected.id}/attendance`}>이 일정 출석 관리</Link></p>}
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
          <label htmlFor="event-start">시작 시각 (한국 시간)</label><Input id="event-start" type="datetime-local" value={startAt} onChange={(change) => setStartAt(change.target.value)} required />
          <label htmlFor="event-end">종료 시각 (한국 시간)</label><Input id="event-end" type="datetime-local" value={endAt} onChange={(change) => setEndAt(change.target.value)} required />
          <label className={styles.check}><Input type="checkbox" checked={obEligible} onChange={(change) => setObEligible(change.target.checked)} /> OB도 참여 대상</label>
          <label className={styles.check}><Input type="checkbox" checked={publicVisible} onChange={(change) => setPublicVisible(change.target.checked)} /> 향후 공개 아카이브 대상</label>
          <p className={styles.hint}>공개 대상으로 표시해도 현재는 외부에 일정을 노출하지 않습니다.</p>
          <div className={styles.actions}>{editable && <Button variant="primary" type="submit" disabled={busy || !title.trim()}>{busy ? "저장 중..." : "저장"}</Button>}
            <Button variant="secondary" type="button" onClick={clear}>닫기</Button></div>
        </form>
        <AdminEventRsvps key={selected.id} eventId={selected.id} />
      </section>}
    </div>
  </div>;
}
