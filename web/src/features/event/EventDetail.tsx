import Link from "next/link";
import { type ChoirEvent, seoulDateTime } from "./events";
import styles from "./EventCalendar.module.css";

type Props = { event: ChoirEvent; memberType: "ACTIVE" | "OB" | null; checkInOpen: boolean; link?: boolean };

export function EventDetail({ event, memberType, checkInOpen, link = false }: Props) {
  return <article className={styles.eventDetail}>
    <p className={styles.eyebrow}>선택한 행사</p>
    <h2>{event.title}</h2>
    <p className={styles.eventTime}>{seoulDateTime(event.startAt)} – {seoulDateTime(event.endAt)}</p>
    <p className={styles.description}>{event.description}</p>
    <p className={event.obEligible ? styles.eligible : styles.muted}>
      {memberType === "OB"
        ? event.obEligible ? "OB 출석 대상 행사입니다." : "OB 출석 대상이 아닙니다."
        : "활동 단원 출석 대상 행사입니다."}
    </p>
    {link && <Link href={`/events/${event.id}`}>행사 자세히 보기</Link>}
    {checkInOpen && (memberType === "ACTIVE" || memberType === "OB" && event.obEligible) &&
      <p><Link href={`/events/${event.id}/check-in`}>현장 출석하기</Link></p>}
  </article>;
}
