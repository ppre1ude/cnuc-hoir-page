import Link from "next/link";
import { ActionLink, Linkify, StatusBadge } from "../../components/ui";
import { type ChoirEvent, seoulDateTime } from "./events";
import styles from "./EventCalendar.module.css";

type Props = { event: ChoirEvent; memberType: "ACTIVE" | "OB" | null; checkInOpen: boolean; link?: boolean };

export function EventDetail({ event, memberType, checkInOpen, link = false }: Props) {
  return <article className={styles.eventDetail}>
    <h2>{event.title}</h2>
    <p className={styles.eventTime}><time dateTime={event.startAt}>{seoulDateTime(event.startAt)}</time><span aria-hidden="true"> ~ </span><time dateTime={event.endAt}>{seoulDateTime(event.endAt)}</time></p>
    {event.description && <p className={styles.description}><Linkify text={event.description} /></p>}
    <div className={styles.eventActions}><StatusBadge tone={event.obEligible ? "positive" : "neutral"}>
      {memberType === "OB"
        ? event.obEligible ? "OB 참여 가능" : "OB 참여 불가"
        : event.obEligible ? "활동 단원 · OB 대상" : "활동 단원 대상"}
    </StatusBadge>
    {link && <Link href={`/events/${event.id}`}>행사 자세히 보기</Link>}
    </div>
    {checkInOpen && (memberType === "ACTIVE" || memberType === "OB" && event.obEligible) &&
      <ActionLink variant="primary" href={`/events/${event.id}/check-in`}>현장 출석하기</ActionLink>}
  </article>;
}
