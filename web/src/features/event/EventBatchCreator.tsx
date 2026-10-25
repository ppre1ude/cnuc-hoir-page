"use client";

import { Button, Input, Textarea, Feedback } from "../../components/ui";

import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { createEventsBatch, seoulDateKey, type EventInput } from "./events";
import styles from "./EventEditor.module.css";

function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

function mondayOffset(month: string) {
  const [year, number] = month.split("-").map(Number);
  return (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
}

type Props = { onCreated: (month: string) => void };

export function EventBatchCreator({ onCreated }: Props) {
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const [dates, setDates] = useState<string[]>([]);
  const [title, setTitle] = useState("전체연습");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [obEligible, setObEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

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
        obEligible, publicVisible: false,
      }));
      await createEventsBatch(items);
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
  return <section className={`${styles.card} ${styles.batch}`}>
    <h2>일정 한 번에 등록</h2>
    <form onSubmit={create} className={styles.form}>
      <label htmlFor="batch-month">월</label>
      <Input id="batch-month" type="month" value={month} onChange={(event) => {
        setMonth(event.target.value); setDates([]); setSaved("");
      }} required />
      <div className={styles.batchWeekdays}>{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.batchDays} aria-label="등록할 날짜">
        {valid && Array.from({ length: mondayOffset(month) }, (_, index) => <span key={`blank-${index}`} />)}
        {days.map((day) => {
          const date = `${month}-${String(day).padStart(2, "0")}`;
          return <Button variant="secondary" key={date} type="button" aria-pressed={dates.includes(date)}
            aria-label={`${day}일`} onClick={() => toggle(date)}>{day}</Button>;
        })}
      </div>
      <p className={styles.selectedDates}>선택한 날짜: {dates.length ? dates.map((date) => `${Number(date.slice(-2))}일`).join(", ") : "없음"}</p>
      <div className={styles.batchFields}>
        <label>제목<Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></label>
        <label>내용 (선택)<Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} rows={3} /></label>
        <label>공통 시작 시각 (한국 시간)<Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
        <label>공통 종료 시각 (한국 시간)<Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
      </div>
      <label className={styles.check}><Input type="checkbox" checked={obEligible} onChange={(event) => setObEligible(event.target.checked)} /> OB도 참여 대상</label>
      {error && <Feedback tone="error">{error}</Feedback>}
      {saved && <Feedback>{saved}</Feedback>}
      <div className={styles.actions}><Button variant="primary" type="submit" disabled={busy || !valid || dates.length === 0 || !title.trim()}>
        {busy ? "등록 중..." : `${dates.length}개 일정 등록`}
      </Button></div>
    </form>
  </section>;
}
