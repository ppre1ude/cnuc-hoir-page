"use client";

import { Button, Input, Feedback, SkeletonRows, StatusBadge } from "../../components/ui";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { ApiRequestError } from "../../lib/api";
import { getNoticePoll, voteNoticePoll, type PollView } from "./notices";
import styles from "./NoticePoll.module.css";

function deadline(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

// 서버 응답을 기다리는 동안 보여 줄 집계입니다. 이전 선택은 빼고 새 선택은 더합니다.
function withVote(poll: PollView, choice: number): PollView {
  const delta = (option: number) => Number(choice === option) - Number(poll.myChoice === option);
  return { ...poll, myChoice: choice, firstCount: poll.firstCount + delta(1), secondCount: poll.secondCount + delta(2) };
}

export function NoticePoll({ noticeId, onChanged }: {
  noticeId: number;
  onChanged?: (noticeId: number, poll: PollView) => void;
}) {
  const [poll, setPoll] = useState<PollView | null>(null);
  // 투표를 누르면 서버 응답 전에 이 값으로 그리고, 저장이 끝나면 poll로 돌아갑니다. 실패해도 poll로 돌아갑니다.
  const [optimisticPoll, showVote] = useOptimistic(poll);
  const [choice, setChoice] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [busy, startSaving] = useTransition();
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    getNoticePoll(noticeId).then((value) => {
      if (!active) return;
      setPoll(value);
      setChoice(value.myChoice);
      setMissing(false);
      setError("");
      onChanged?.(noticeId, value);
    }).catch((caught) => {
      if (!active) return;
      if (caught instanceof ApiRequestError && caught.status === 404) setMissing(true);
      else setError("투표를 불러오지 못했습니다.");
    });
    return () => { active = false; };
  }, [noticeId, retry, onChanged]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (choice === null || busy || !poll) return;
    const form = event.currentTarget;
    startSaving(async () => {
      showVote(withVote(poll, choice));
      setError("");
      setSaved(false);
      try {
        const result = await voteNoticePoll(noticeId, choice);
        setPoll(result);
        setChoice(result.myChoice);
        setSaved(true);
        onChanged?.(noticeId, result);
        // 저장하면 "선택 변경" 버튼이 비활성으로 바뀌어 초점이 사라지므로 고른 선택지로 초점을 옮깁니다.
        // 저장을 기다리는 동안 다른 곳으로 옮겨 간 초점은 빼앗지 않습니다.
        if (form.contains(document.activeElement) || document.activeElement === document.body) {
          form.querySelector<HTMLInputElement>(`input[value="${result.myChoice}"]`)?.focus();
        }
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.code === "POLL_CLOSED") {
          setError("투표가 마감되었습니다.");
          setRetry((value) => value + 1);
        } else setError("투표를 저장하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  }

  if (missing) return null;
  if (!poll && !error) return <SkeletonRows count={2} label="투표를 불러오는 중입니다." />;
  if (!poll) return <div role="alert">{error} <Button variant="secondary" type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button></div>;

  const shown = optimisticPoll ?? poll;
  const total = shown.firstCount + shown.secondCount;
  return <form className={styles.poll} onSubmit={submit} aria-labelledby={`poll-question-${noticeId}`} aria-busy={busy}>
    <div className={styles.heading}><h3 id={`poll-question-${noticeId}`}>{shown.question}</h3><StatusBadge tone={shown.closed ? "neutral" : "positive"}>{shown.closed ? "마감" : "진행 중"}</StatusBadge></div>
    <p className={styles.deadline}>마감 <time dateTime={shown.closesAt}>{deadline(shown.closesAt)}</time> · {total}명 참여</p>
    <p className={styles.deadline}>선택은 이름과 함께 운영진에게 표시됩니다.</p>
    {/* 저장 중에 disabled를 걸면 엔터를 누른 선택지에서 초점이 빠지므로, 저장 중에는 선택 변경만 무시합니다. */}
    <fieldset disabled={shown.closed}>
      <legend className={styles.srOnly}>투표 선택지</legend>
      {[{ value: 1, label: shown.firstOption, count: shown.firstCount },
        { value: 2, label: shown.secondOption, count: shown.secondCount }].map((option) =>
        <label key={option.value} className={`${styles.option} ${choice === option.value ? styles.selected : ""}`}>
          <Input type="radio" name={`poll-${noticeId}`} value={option.value} checked={choice === option.value}
            onChange={() => { if (busy) return; setChoice(option.value); setSaved(false); }} />
          <span className={styles.label}>{option.label}</span>
          <span className={styles.count}>{option.count}명</span>
          <span className={styles.bar} style={{ width: `${total ? option.count / total * 100 : 0}%` }} aria-hidden="true" />
        </label>)}
    </fieldset>
    {shown.myChoice !== null && <p className={styles.mine}>내 선택: {shown.myChoice === 1 ? shown.firstOption : shown.secondOption}</p>}
    {error && <Feedback tone="error">{error}</Feedback>}
    <p className={styles.srOnly} role="status">{saved ? "투표가 저장되었습니다." : ""}</p>
    {/* 저장이 끝날 때까지 버튼은 서버가 확인한 선택(poll)과 비교해 켜 둡니다. 끄면 누른 버튼에서 초점이 빠집니다. */}
    {!shown.closed && <Button variant="primary" type="submit" aria-disabled={busy || undefined}
      disabled={choice === null || (!busy && choice === poll.myChoice)}>
      {busy ? "저장 중…" : shown.myChoice === null ? "투표하기" : "선택 변경"}
    </Button>}
  </form>;
}
