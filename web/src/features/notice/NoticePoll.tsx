"use client";

import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api";
import { getNoticePoll, voteNoticePoll, type PollView } from "./notices";
import styles from "./NoticePoll.module.css";

function deadline(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

export function NoticePoll({ noticeId }: { noticeId: number }) {
  const [poll, setPoll] = useState<PollView | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getNoticePoll(noticeId).then((value) => {
      if (!active) return;
      setPoll(value);
      setChoice(value.myChoice);
      setMissing(false);
      setError("");
    }).catch((caught) => {
      if (!active) return;
      if (caught instanceof ApiRequestError && caught.status === 404) setMissing(true);
      else setError("투표를 불러오지 못했습니다.");
    });
    return () => { active = false; };
  }, [noticeId, retry]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (choice === null || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await voteNoticePoll(noticeId, choice);
      setPoll(result);
      setChoice(result.myChoice);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "POLL_CLOSED") {
        setError("투표가 마감되었습니다.");
        setRetry((value) => value + 1);
      } else setError("투표를 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  if (missing) return null;
  if (!poll && !error) return <p role="status">투표를 불러오는 중입니다.</p>;
  if (!poll) return <div role="alert">{error} <button type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</button></div>;

  const total = poll.firstCount + poll.secondCount;
  return <form className={styles.poll} onSubmit={submit}>
    <div className={styles.heading}><h3>{poll.question}</h3><span>{poll.closed ? "마감" : "진행 중"}</span></div>
    <p className={styles.deadline}>마감 {deadline(poll.closesAt)} · {total}명 참여</p>
    <fieldset disabled={poll.closed || busy}>
      <legend className={styles.srOnly}>투표 선택지</legend>
      {[{ value: 1, label: poll.firstOption, count: poll.firstCount },
        { value: 2, label: poll.secondOption, count: poll.secondCount }].map((option) =>
        <label key={option.value} className={`${styles.option} ${choice === option.value ? styles.selected : ""}`}>
          <input type="radio" name={`poll-${noticeId}`} value={option.value} checked={choice === option.value}
            onChange={() => setChoice(option.value)} />
          <span className={styles.label}>{option.label}</span>
          <span className={styles.count}>{option.count}명</span>
          <span className={styles.bar} style={{ width: `${total ? option.count / total * 100 : 0}%` }} aria-hidden="true" />
        </label>)}
    </fieldset>
    {poll.myChoice !== null && <p className={styles.mine}>내 선택: {poll.myChoice === 1 ? poll.firstOption : poll.secondOption}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!poll.closed && <button className={styles.submit} type="submit" disabled={choice === null || busy || choice === poll.myChoice}>
      {poll.myChoice === null ? "투표하기" : "선택 변경"}
    </button>}
  </form>;
}
