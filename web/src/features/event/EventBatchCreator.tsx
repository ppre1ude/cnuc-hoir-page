"use client";

import { Button, Input, Select, Textarea, Feedback , Section } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";

import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { canManageEvent, type Part } from "../auth/session";
import { useSession } from "../auth/SessionProvider";
import { partLabel, parts } from "../member/roles";
import { createEventsBatch, scheduleKindLabel, scheduleKinds, seoulDateKey, type EventInput, type ScheduleKind } from "./events";
import styles from "./EventEditor.module.css";
import { openPicker } from "./eventTime";

// 마지막에 등록한 시각을 이 브라우저에 기억해 둡니다. 연습 시각은 거의 같아서 다음에 열면 그대로 쓰면 됩니다.
const timesKey = "event-batch-times";
function rememberedTimes(): { start: string; end: string } {
  try { return { start: "", end: "", ...JSON.parse(localStorage.getItem(timesKey) ?? "{}") }; } catch { return { start: "", end: "" }; }
}
function rememberTimes(start: string, end: string) {
  try { localStorage.setItem(timesKey, JSON.stringify({ start, end })); } catch { /* 저장소가 막힌 브라우저에서는 기억하지 않습니다. */ }
}

function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

function sundayOffset(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
}

type Props = { onCreated: (month: string) => void };

// 종류를 고르면 채우는 제목입니다. 행사는 이름이 제각각이라 비워 둡니다.
function defaultTitle(kind: ScheduleKind, part: Part | null) {
  if (kind === "REGULAR_REHEARSAL") return "정기연습";
  if (kind === "EXTRA_REHEARSAL") return "비정기연습";
  if (kind === "PART_REHEARSAL" && part) return `${partLabel[part]} 파트연습`;
  return "";
}

// 운영진이 가장 자주 하는 일은 이번 달 정기연습 날짜를 한꺼번에 넣는 것이라, 이 폼이 페이지 맨 위에 옵니다.
// 왼쪽 달력에서 날짜를 고르고 오른쪽에 내용을 적으면 고른 날짜마다 같은 일정이 생깁니다.
export function EventBatchCreator({ onCreated }: Props) {
  const session = useSession();
  // 이 사람이 열 수 있는 종류와 파트만 고르게 합니다. 서버도 같은 규칙으로 다시 검사합니다.
  const partChoices = parts.filter((item) => canManageEvent(session, "PART_REHEARSAL", item));
  const kindChoices = scheduleKinds.filter((item) => item === "PART_REHEARSAL" ? partChoices.length > 0 : canManageEvent(session, item, null));
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const [dates, setDates] = useState<string[]>([]);
  const [kind, setKind] = useState<ScheduleKind>(kindChoices[0] ?? "EVENT");
  const [part, setPart] = useState<Part | null>(partChoices[0] ?? null);
  const [title, setTitle] = useState(() => defaultTitle(kindChoices[0] ?? "EVENT", partChoices[0] ?? null));
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(() => rememberedTimes().start);
  const [endTime, setEndTime] = useState(() => rememberedTimes().end);
  const [obEligible, setObEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  // 제목을 직접 고치지 않았을 때만 종류·파트에 맞춰 제목을 바꿉니다.
  function choose(nextKind: ScheduleKind, nextPart: Part | null) {
    if (title === defaultTitle(kind, part)) setTitle(defaultTitle(nextKind, nextPart));
    setKind(nextKind); setPart(nextPart); setSaved("");
  }

  function toggle(date: string) {
    setDates((current) => current.includes(date) ? current.filter((item) => item !== date)
      : [...current, date].sort());
    setSaved("");
  }

  async function create(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (busy) return;
    if (dates.length === 0) { setError("날짜를 선택해 주세요."); return; }
    if (!startTime || !endTime || startTime >= endTime) {
      setError("시작 시각과 종료 시각을 확인해 주세요."); return;
    }
    setBusy(true); setError(""); setSaved("");
    try {
      // 시각이 어긋나 toISOString이 예외를 내도 아무 반응 없이 끝나지 않게, try 안에서 만들어 안내 문구를 띄웁니다.
      const items: EventInput[] = dates.map((date) => ({
        title: title.trim(), description: description.trim(),
        startAt: new Date(`${date}T${startTime}:00+09:00`).toISOString(),
        endAt: new Date(`${date}T${endTime}:00+09:00`).toISOString(),
        kind, part: kind === "PART_REHEARSAL" ? part : null, obEligible, publicVisible: false,
      }));
      await createEventsBatch(items);
      rememberTimes(startTime, endTime);
      setSaved(`${items.length}개 일정을 등록했습니다.`);
      setDates([]);
      onCreated(month);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "일정을 등록하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 월 입력을 지우면 ""가 들어옵니다. 그때는 날짜를 그리지 않고 등록도 막습니다.
  const valid = /^\d{4}-\d{2}$/.test(month);
  const days = valid ? Array.from({ length: monthDays(month) }, (_, index) => index + 1) : [];
  return <Section title="일정 등록" id="batch-title" description="달력에서 날짜를 고르고 오른쪽에 내용을 적으면, 고른 날짜마다 같은 일정이 생깁니다.">
    <form onSubmit={create} className={styles.workspace}>
      <div className={styles.picker}>
        <label htmlFor="batch-month">월</label>
        <Input id="batch-month" type="month" value={month} onChange={(event) => {
          setMonth(event.target.value); setDates([]); setSaved("");
        }} required />
        <div className={styles.weekdays}>{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.days} aria-label="등록할 날짜">
          {valid && Array.from({ length: sundayOffset(month) }, (_, index) => <span key={`blank-${index}`} />)}
          {days.map((day) => {
            const date = `${month}-${String(day).padStart(2, "0")}`;
            return <button key={date} type="button" className={styles.day} aria-pressed={dates.includes(date)}
              aria-label={`${day}일`} onClick={() => toggle(date)}>{day}</button>;
          })}
        </div>
        <p className={styles.selectedDates}>고른 날짜: {dates.length ? dates.map((date) => `${Number(date.slice(-2))}일`).join(", ") : "없음"}</p>
      </div>
      <div className={styles.fields}>
        <div className={styles.fieldGrid}>
          <label>종류<Select value={kind} onChange={(event) => choose(event.target.value as ScheduleKind, part)}>
            {kindChoices.map((item) => <option key={item} value={item}>{scheduleKindLabel[item]}</option>)}
          </Select></label>
          {kind === "PART_REHEARSAL" && <label>파트<Select value={part ?? ""} onChange={(event) => choose(kind, event.target.value as Part)}>
            {partChoices.map((item) => <option key={item} value={item}>{partLabel[item]}</option>)}
          </Select></label>}
          <label className={styles.wide}>제목<Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></label>
          <label className={styles.wide}>내용 (선택)<Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} rows={3} /></label>
          <label>공통 시작 시각 (한국 시간)<Input type="time" value={startTime} min="00:00" step={300} onClick={(event) => openPicker(event.currentTarget)} onChange={(event) => setStartTime(event.target.value)} required /></label>
          <label>공통 종료 시각 (한국 시간)<Input type="time" value={endTime} min="00:00" step={300} onClick={(event) => openPicker(event.currentTarget)} onChange={(event) => setEndTime(event.target.value)} required /></label>
        </div>
        <label className={styles.check}><Input type="checkbox" checked={obEligible} onChange={(event) => setObEligible(event.target.checked)} /> OB도 참여 대상</label>
        {error && <Feedback tone="error">{error}</Feedback>}
        {saved && <Feedback>{saved}</Feedback>}
        <div className={ui.actions}><Button variant="primary" type="submit" disabled={busy || !valid || dates.length === 0 || !title.trim()}>
          {busy ? "등록 중..." : `${dates.length}개 일정 등록`}
        </Button></div>
      </div>
    </form>
  </Section>;
}
