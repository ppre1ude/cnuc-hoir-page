"use client";

import { Button, Feedback, StatusBadge } from "../../components/ui";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { ApiRequestError } from "../../lib/api";
import { setEventRsvp, type ChoirEvent, type EventRsvpChoice } from "./events";
import styles from "./EventCalendar.module.css";

type Props = {
  event: ChoirEvent;
  memberType: "ACTIVE" | "OB" | null;
  choice: EventRsvpChoice | null;
  onSaved: (choice: EventRsvpChoice) => void;
  compact?: boolean;
};

const labels = { ATTENDING: "참석", ABSENT: "불참" } as const;
// 매주 같은 이름의 연습이 이어지므로 목록 버튼의 이름에 날짜를 붙여 구분합니다.
const seoulDay = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

export function EventRsvp({ event, memberType, choice, onSaved, compact = false }: Props) {
  const [busy, startSaving] = useTransition();
  // 누른 즉시 이 값으로 배지를 바꾸고, 저장이 끝나면 부모가 준 choice로 돌아갑니다. 실패해도 이전 값으로 돌아갑니다.
  const [shown, showChoice] = useOptimistic(choice);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [closed, setClosed] = useState(() => new Date(event.startAt).getTime() <= Date.now());
  const eligible = memberType === "ACTIVE" || (memberType === "OB" && event.obEligible);

  useEffect(() => {
    const startAt = new Date(event.startAt).getTime();
    let timer: number;
    const schedule = () => {
      const remaining = startAt - Date.now();
      if (remaining <= 0) { setClosed(true); return; }
      timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    if (startAt > Date.now()) schedule();
    return () => window.clearTimeout(timer);
  }, [event.startAt]);

  function respond(next: EventRsvpChoice) {
    if (busy) return;
    startSaving(async () => {
      showChoice(next);
      setError(""); setSavedMessage("");
      try {
        const saved = await setEventRsvp(event.id, next);
        if (saved.choice) { onSaved(saved.choice); setSavedMessage(`${labels[saved.choice]} 응답이 저장되었습니다.`); }
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.status === 409) {
          setClosed(true);
          setError("일정이 시작되어 응답을 변경할 수 없습니다.");
        } else setError("응답을 저장하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  }

  // 저장 중에 disabled를 걸면 누른 버튼에서 초점이 빠지므로 aria-disabled로 알리고 respond에서 막습니다.
  if (!eligible) return compact ? <span className={styles.quickStatus}>대상 아님</span> : null;
  if (compact) return <div className={styles.quickRsvp} role="group" aria-label={`${event.title} 참석 응답`} aria-busy={busy}>
    {/* 지난 일정의 "참석"이 출석으로 읽히지 않게 응답임을 밝힙니다. */}
    {closed ? <span className={styles.quickStatus}>{shown ? `${labels[shown]} 응답` : "미응답"}</span>
      : (["ATTENDING", "ABSENT"] as const).map((item) => <Button variant="secondary" type="button" key={item}
        aria-label={`${seoulDay.format(new Date(event.startAt))} ${event.title} ${labels[item]}`} aria-pressed={shown === item}
        aria-disabled={busy || undefined} onClick={() => respond(item)}>{labels[item]}</Button>)}
    {error && <Feedback tone="error">{error}</Feedback>}
    <span className={styles.srOnly} role="status">{savedMessage}</span>
  </div>;
  return <div className={styles.rsvp} role="group" aria-label="참석 응답" aria-busy={busy}>
    <strong>참석 응답</strong>
    <StatusBadge tone={shown ? "positive" : "neutral"}>{shown ? labels[shown] : "미응답"}</StatusBadge>
    {closed && <span className={styles.quickStatus}>응답 마감</span>}
    {!closed && <div className={styles.rsvpButtons}>
      {(["ATTENDING", "ABSENT"] as const).map((item) => <Button variant="secondary" type="button" key={item}
        aria-pressed={shown === item} aria-disabled={busy || undefined} onClick={() => respond(item)}>{labels[item]}</Button>)}
    </div>}
    {error && <Feedback tone="error">{error}</Feedback>}
    <span className={styles.srOnly} role="status">{savedMessage}</span>
  </div>;
}
