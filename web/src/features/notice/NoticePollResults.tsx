import { rosterName } from "../member/roles";
import type { AdminPollView } from "./notices";
import styles from "../member/AdminPages.module.css";

const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

// 이미 붙은 투표의 집계와 응답자 명단입니다. 등록한 투표는 바꿀 수 없으므로 읽기만 합니다.
export function NoticePollResults({ view }: { view: AdminPollView }) {
  const { poll, respondents } = view;
  return <section className={styles.pollDetails} aria-label="투표 결과">
    <h3>{poll.question}</h3>
    <p>마감 {dateTime(poll.closesAt)}</p>
    <p>{poll.firstOption} {poll.firstCount}명, {poll.secondOption} {poll.secondCount}명</p>
    <h4>응답자</h4>
    {respondents.length === 0 && <p>아직 응답이 없습니다.</p>}
    <ul>{respondents.map((respondent) => <li key={respondent.memberId}>
      <span>{rosterName(respondent)}</span>
      <strong>{respondent.choice === 1 ? poll.firstOption : poll.secondOption}</strong>
    </li>)}</ul>
  </section>;
}
