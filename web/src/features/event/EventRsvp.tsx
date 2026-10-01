"use client";

import { Button, Feedback } from "../../components/ui";

import { useEffect, useState } from "react";
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

export function EventRsvp({ event, memberType, choice, onSaved, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
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

  async function respond(next: EventRsvpChoice) {
    if (busy) return;
    setBusy(true); setError(""); setSavedMessage("");
    try {
      const saved = await setEventRsvp(event.id, next);
      if (saved.choice) { onSaved(saved.choice); setSavedMessage(`${labels[saved.choice]} 응답이 저장되었습니다.`); }
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) {
        setClosed(true);
        setError("행사가 시작되어 응답을 변경할 수 없습니다.");
      } else setError("응답을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  if (!eligible) return compact ? <span className={styles.quickStatus}>대상 아님</span> : null;
  if (compact) return <div className={styles.quickRsvp} role="group" aria-label={`${event.title} 참석 응답`} aria-busy={busy}>
    {closed ? <span className={styles.quickStatus}>{choice ? labels[choice] : "미응답"}</span>
      : (["ATTENDING", "ABSENT"] as const).map((item) => <Button variant="secondary" type="button" key={item}
        aria-label={`${event.title} ${labels[item]}`} aria-pressed={choice === item} disabled={busy}
        onClick={() => void respond(item)}>{labels[item]}</Button>)}
    {error && <Feedback tone="error">{error}</Feedback>}
    <span className={styles.srOnly} role="status">{savedMessage}</span>
  </div>;
  return <div className={styles.rsvp} role="group" aria-label="참석 응답" aria-busy={busy}>
    <strong>참석 의사</strong>
    <span className={styles.rsvpStatus}>{choice ? labels[choice] : "미응답"}</span>
    {closed && <span className={styles.quickStatus}>응답 마감</span>}
    {!closed && <div className={styles.rsvpButtons}>
      {(["ATTENDING", "ABSENT"] as const).map((item) => <Button variant="secondary" type="button" key={item}
        aria-pressed={choice === item} disabled={busy} onClick={() => void respond(item)}>{labels[item]}</Button>)}
    </div>}
    {error && <Feedback tone="error">{error}</Feedback>}
    <span className={styles.srOnly} role="status">{savedMessage}</span>
  </div>;
}
