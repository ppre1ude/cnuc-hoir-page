import Link from "next/link";
import { ActionLink, Linkify, StatusBadge } from "../../components/ui";
import type { Part } from "../auth/session";
import { type ChoirEvent, eventAudienceLabel, eventEndLabel, isEventTarget, seoulDateTime } from "./events";
import styles from "./EventCalendar.module.css";

type Props = {
  event: ChoirEvent; memberType: "ACTIVE" | "OB" | null; part?: Part | null; checkInOpen: boolean; link?: boolean;
};

// 홈 달력의 일정 카드입니다. 일정 상세 페이지는 EventPage가 조립 부품으로 따로 그립니다.
export function EventDetail({ event, memberType, part = null, checkInOpen, link = false }: Props) {
  return <article className={styles.eventDetail}>
    <h2 className={event.cancelledAt ? styles.cancelled : undefined}>{event.title}</h2>
    {event.cancelledAt && <p><StatusBadge tone="neutral">취소된 일정입니다</StatusBadge></p>}
    <p className={`${styles.eventTime} ${event.cancelledAt ? styles.cancelled : ""}`}><time dateTime={event.startAt}>{seoulDateTime(event.startAt)}</time><span aria-hidden="true"> ~ </span><time dateTime={event.endAt}>{eventEndLabel(event)}</time></p>
    {event.description && <p className={styles.description}><Linkify text={event.description} /></p>}
    <div className={styles.eventActions}><StatusBadge tone={event.obEligible ? "positive" : "neutral"}>
      {eventAudienceLabel(event, memberType)}
    </StatusBadge>
    {link && <Link href={`/events/${event.id}`}>자세히 보기</Link>}
    </div>
    {checkInOpen && isEventTarget(event, { memberType, part }) &&
      <ActionLink variant="primary" href={`/events/${event.id}/check-in`}>현장 출석하기</ActionLink>}
  </article>;
}
