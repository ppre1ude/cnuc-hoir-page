"use client";

import { Button, Input } from "../../components/ui";
import type { Draft, PollKind } from "./noticeDraft";
import styles from "../member/AdminPages.module.css";

// 체크박스와 형식 선택을 합친 버튼 묶음입니다. 가입 승인의 단원 구분 버튼과 같은 패턴입니다.
const kinds: { value: PollKind; label: string; options?: [string, string] }[] = [
  { value: "none", label: "없음" },
  { value: "attendance", label: "참석 / 불참", options: ["참석", "불참"] },
  { value: "agree", label: "찬성 / 반대", options: ["찬성", "반대"] },
  { value: "custom", label: "직접 입력" },
];

export function NoticePollChoice({ value, onChange }: { value: Draft; onChange: (patch: Partial<Draft>) => void }) {
  return <div className={styles.pollChoice}>
    <span className={styles.fieldLabel} id="poll-kind-label">투표</span>
    <div className={styles.choice} role="group" aria-labelledby="poll-kind-label">
      {kinds.map((kind) => <Button key={kind.value} variant="secondary" type="button" aria-pressed={value.poll === kind.value}
        onClick={() => onChange({ poll: kind.value, ...(kind.options ? { firstOption: kind.options[0], secondOption: kind.options[1] } : {}) })}>
        {kind.label}
      </Button>)}
    </div>
    {value.poll !== "none" && <div className={styles.pollFields}>
      <label htmlFor="poll-question">질문</label>
      <Input id="poll-question" value={value.pollQuestion} onChange={(event) => onChange({ pollQuestion: event.target.value })} maxLength={200} required />
      <label htmlFor="poll-first">첫 번째 선택지</label>
      {/* 미리 채운 선택지를 고치면 "직접 입력"으로 표시가 옮겨 갑니다. */}
      <Input id="poll-first" value={value.firstOption} onChange={(event) => onChange({ firstOption: event.target.value, poll: "custom" })} maxLength={80} required />
      <label htmlFor="poll-second">두 번째 선택지</label>
      <Input id="poll-second" value={value.secondOption} onChange={(event) => onChange({ secondOption: event.target.value, poll: "custom" })} maxLength={80} required />
      <label htmlFor="poll-closes">마감 시각 (한국 시간)</label>
      <Input id="poll-closes" type="datetime-local" value={value.pollClosesAt} onChange={(event) => onChange({ pollClosesAt: event.target.value })} required />
      <p>등록한 투표의 질문과 선택지는 변경할 수 없습니다.</p>
      <p>응답자 이름과 선택은 운영진에게 표시됩니다. 익명 투표는 지원하지 않습니다.</p>
      <p>투표의 참석과 불참은 일정의 참석 응답이나 출석 기록에 반영되지 않습니다.</p>
    </div>}
  </div>;
}
