import Link from "next/link";
import { ActionLink, Linkify, StatusBadge } from "../../components/ui";
import type { Part } from "../auth/session";
import { type ChoirEvent, eventAudience, isEventTarget, seoulDateKey, seoulDateTime } from "./events";
import styles from "./EventCalendar.module.css";

type Props = {
  event: ChoirEvent; memberType: "ACTIVE" | "OB" | null; part?: Part | null; checkInOpen: boolean; link?: boolean; showTitle?: boolean;
};

const seoulTime = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", timeStyle: "short" });

// 같은 날 끝나는 일정은 날짜를 두 번 읽지 않게 끝 시각만 보여 줍니다.
function endLabel(event: ChoirEvent) {
  return seoulDateKey(event.startAt) === seoulDateKey(event.endAt) ? seoulTime.format(new Date(event.endAt)) : seoulDateTime(event.endAt);
}

// 일정 페이지는 제목을 h1으로 이미 보여 주므로 showTitle={false}로 h2를 뺍니다.
export function EventDetail({ event, memberType, part = null, checkInOpen, link = false, showTitle = true }: Props) {
  return <article className={styles.eventDetail}>
    {showTitle && <h2>{event.title}</h2>}
    <p className={styles.eventTime}><time dateTime={event.startAt}>{seoulDateTime(event.startAt)}</time><span aria-hidden="true"> ~ </span><time dateTime={event.endAt}>{endLabel(event)}</time></p>
    {event.description && <p className={styles.description}><Linkify text={event.description} /></p>}
    <div className={styles.eventActions}><StatusBadge tone={event.obEligible ? "positive" : "neutral"}>
      {memberType === "OB"
        ? event.obEligible ? "OB 참여 가능" : "OB 참여 불가"
        : `${eventAudience(event)} 대상`}
    </StatusBadge>
    {link && <Link href={`/events/${event.id}`}>자세히 보기</Link>}
    </div>
    {checkInOpen && isEventTarget(event, { memberType, part }) &&
      <ActionLink variant="primary" href={`/events/${event.id}/check-in`}>현장 출석하기</ActionLink>}
  </article>;
}
