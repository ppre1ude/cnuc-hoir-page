"use client";

import { Button, Input, Select, Textarea, Feedback, PageHeader, SkeletonRows } from "../../components/ui";

import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api";
import { createNotice, getAdminNoticePoll, getAdminNotices, updateNotice,
  type AdminPollView, type Notice, type NoticePage, type PollInput } from "./notices";
import { rosterName } from "../member/roles";
import styles from "../member/AdminPages.module.css";

type Draft = {
  title: string; body: string; published: boolean; includePoll: boolean; pollPreset: "attendance" | "agree" | "custom";
  pollQuestion: string; firstOption: string; secondOption: string; pollClosesAt: string;
};
const emptyDraft: Draft = { title: "", body: "", published: false, includePoll: false, pollPreset: "attendance",
  pollQuestion: "", firstOption: "참석", secondOption: "불참", pollClosesAt: "" };

// 세션이 30분 유휴로 끝나면 로그인 화면으로 넘어가므로, 같은 탭에서 돌아왔을 때 쓰던 새 공지를 되살립니다.
const draftKey = "notice-draft";
function readDraft(): Draft {
  try { return { ...emptyDraft, ...JSON.parse(sessionStorage.getItem(draftKey) ?? "{}") }; } catch { return emptyDraft; }
}
function writeDraft(draft: Draft) {
  try {
    if (JSON.stringify(draft) === JSON.stringify(emptyDraft)) sessionStorage.removeItem(draftKey);
    else sessionStorage.setItem(draftKey, JSON.stringify(draft));
  } catch { /* 저장소가 막힌 브라우저에서는 임시 저장 없이 씁니다. */ }
}

export function NoticeEditor() {
  const [data, setData] = useState<NoticePage | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [form, setForm] = useState<Draft>(readDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pollStatus, setPollStatus] = useState<"none" | "loading" | "exists" | "error">("none");
  const [adminPoll, setAdminPoll] = useState<AdminPollView | null>(null);
  const [pollRetry, setPollRetry] = useState(0);
  const update = (patch: Partial<Draft>) => setForm((value) => ({ ...value, ...patch }));
  const { title, body, published, includePoll, pollPreset, pollQuestion, firstOption, secondOption, pollClosesAt } = form;

  useEffect(() => { if (!selected) writeDraft(form); }, [selected, form]);

  useEffect(() => {
    let alive = true;
    getAdminNotices(page).then((result) => {
      if (!alive) return;
      setData(result);
      setListError("");
    }).catch(() => { if (alive) setListError("공지 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page, retry]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    getAdminNoticePoll(selected.id).then((result) => {
      if (!active) return;
      setAdminPoll(result);
      setPollStatus("exists");
    }).catch((caught) => {
      if (!active) return;
      setAdminPoll(null);
      setPollStatus(caught instanceof ApiRequestError && caught.status === 404 ? "none" : "error");
    });
    return () => { active = false; };
  }, [selected, pollRetry]);

  function edit(notice: Notice) {
    setSelected(notice);
    setPollStatus("loading");
    setAdminPoll(null);
    setForm({ ...emptyDraft, title: notice.title, body: notice.body, published: notice.published });
  }

  function startNew(next: Draft) {
    setSelected(null);
    setPollStatus("none");
    setAdminPoll(null);
    setForm(next);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      let poll: PollInput | undefined;
      if (includePoll) {
        const closesAt = new Date(`${pollClosesAt}:00+09:00`);
        if (Number.isNaN(closesAt.getTime())) {
          setError("투표 마감 시각을 확인해 주세요.");
          setBusy(false);
          return;
        }
        poll = { question: pollQuestion.trim(), firstOption: firstOption.trim(),
          secondOption: secondOption.trim(), closesAt: closesAt.toISOString() };
      }
      const input = { title: title.trim(), body, published, ...(poll ? { poll } : {}) };
      if (selected) await updateNotice(selected.id, input);
      else await createNotice(input);
      // 기존 공지를 고쳤다면 임시 저장한 새 공지는 아직 저장되지 않았으므로 되살립니다.
      startNew(selected ? readDraft() : emptyDraft);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiRequestError && ["INVALID_POLL", "POLL_EXISTS"].includes(caught.code)
        ? caught.message : "공지를 저장하지 못했습니다.");
      setBusy(false);
      return;
    }
    try {
      setData(await getAdminNotices(page));
      setListError("");
    } catch {
      setData(null);
      setListError("공지는 저장됐지만 목록을 새로고침하지 못했습니다.");
    } finally { setBusy(false); }
  }

  const visibleData = !listError && data?.page === page ? data : null;
  return <section className={styles.page}>
    <PageHeader title="공지 관리" />
    {error && <Feedback tone="error">{error}</Feedback>}
    {saved && <Feedback tone="success">공지를 저장했습니다.</Feedback>}
    {listError && <><Feedback tone="error">{listError}</Feedback><Button variant="secondary" type="button" onClick={() => { setListError(""); setData(null); setRetry(retry + 1); }}>다시 시도</Button></>}
    {/* 단원 명단과 같은 틀입니다. 왼쪽 좁은 칸에 공지 목록과 새 공지 버튼, 오른쪽에 작성 또는 수정 폼. */}
    <div className={styles.workspace}><div className={styles.roster}>
      <Button variant="secondary" type="button" className={styles.newItem} onClick={() => startNew(readDraft())}>새 공지</Button>
      {!visibleData && !listError && <SkeletonRows count={4} label="공지 목록을 불러오는 중입니다." />}
      {visibleData && <>
      {visibleData.items.length === 0 && <p>작성된 공지가 없습니다.</p>}
      <ul className={styles.rosterList} aria-label="공지 목록">
        {visibleData.items.map((notice) => <li key={notice.id}>
          <button type="button" className={styles.rosterRow} aria-current={selected?.id === notice.id ? "true" : undefined} onClick={() => edit(notice)}>
            <strong>{notice.title}</strong><span data-tone={notice.published ? undefined : "attention"}>{notice.published ? "게시" : "초안"}</span>
          </button>
        </li>)}
      </ul>
      {visibleData.total > visibleData.size && <nav className={styles.pagination} aria-label="공지 관리 페이지">
        <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
        <span>{page + 1} / {Math.ceil(visibleData.total / visibleData.size)}</span>
        <Button variant="secondary" type="button" disabled={(page + 1) * visibleData.size >= visibleData.total} onClick={() => setPage(page + 1)}>다음</Button>
      </nav>}
    </>}</div>
      <form className={`${styles.detail} ${styles.form}`} onSubmit={save}>
        <h2>{selected ? "공지 수정" : "새 공지"}</h2>
        <label htmlFor="notice-title">제목</label>
        <Input id="notice-title" value={title} onChange={(event) => update({ title: event.target.value })} maxLength={200} required />
        <label htmlFor="notice-body">본문</label>
        <Textarea id="notice-body" value={body} onChange={(event) => update({ body: event.target.value })} maxLength={10000} required />
        <label className={styles.check} htmlFor="notice-published"><Input id="notice-published" type="checkbox" checked={published} onChange={(event) => update({ published: event.target.checked })} /> 게시</label>
        {pollStatus === "loading" && <SkeletonRows count={2} label="투표 정보를 불러오는 중입니다." />}
        {pollStatus === "error" && <Feedback tone="error">투표 정보를 불러오지 못했습니다.
          <Button variant="secondary" type="button" onClick={() => { setPollStatus("loading"); setPollRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
        {adminPoll && <section className={styles.pollDetails} aria-label="투표 결과">
          <h3>{adminPoll.poll.question}</h3>
          <p>마감 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(adminPoll.poll.closesAt))}</p>
          <p>{adminPoll.poll.firstOption} {adminPoll.poll.firstCount}명, {adminPoll.poll.secondOption} {adminPoll.poll.secondCount}명</p>
          <h4>응답자</h4>
          {adminPoll.respondents.length === 0 && <p>아직 응답이 없습니다.</p>}
          <ul>{adminPoll.respondents.map((respondent) => <li key={respondent.memberId}>
            <span>{rosterName(respondent)}</span>
            <strong>{respondent.choice === 1 ? adminPoll.poll.firstOption : adminPoll.poll.secondOption}</strong>
          </li>)}</ul>
        </section>}
        {pollStatus === "none" && <>
          <label className={styles.check} htmlFor="notice-poll"><Input id="notice-poll" type="checkbox" checked={includePoll}
            onChange={(event) => update({ includePoll: event.target.checked })} /> 투표 추가</label>
          {includePoll && <div className={styles.pollFields}>
            <label htmlFor="poll-question">질문</label>
            <Input id="poll-question" value={pollQuestion} onChange={(event) => update({ pollQuestion: event.target.value })} maxLength={200} required />
            <label htmlFor="poll-preset">선택지 형식</label>
            <Select id="poll-preset" value={pollPreset}
              onChange={(event) => { const next = event.target.value as Draft["pollPreset"];
                update({ pollPreset: next, ...(next === "agree" ? { firstOption: "찬성", secondOption: "반대" }
                  : next === "attendance" ? { firstOption: "참석", secondOption: "불참" } : {}) }); }}>
              <option value="attendance">참석 / 불참</option><option value="agree">찬성 / 반대</option><option value="custom">직접 입력</option>
            </Select>
            <label htmlFor="poll-first">첫 번째 선택지</label>
            <Input id="poll-first" value={firstOption} onChange={(event) => update({ firstOption: event.target.value, pollPreset: "custom" })} maxLength={80} required />
            <label htmlFor="poll-second">두 번째 선택지</label>
            <Input id="poll-second" value={secondOption} onChange={(event) => update({ secondOption: event.target.value, pollPreset: "custom" })} maxLength={80} required />
            <label htmlFor="poll-closes">마감 시각 (한국 시간)</label>
            <Input id="poll-closes" type="datetime-local" value={pollClosesAt} onChange={(event) => update({ pollClosesAt: event.target.value })} required />
            <p>등록한 투표의 질문과 선택지는 변경할 수 없습니다.</p>
            <p>응답자 이름과 선택은 운영진에게 표시됩니다. 익명 투표는 지원하지 않습니다.</p>
            <p>투표의 참석·불참은 일정의 참석 응답이나 출석 기록에 반영되지 않습니다.</p>
          </div>}
        </>}
        <div className={styles.actions}><Button variant="primary" type="submit" disabled={busy || !title.trim() || !body.trim()}>저장</Button></div>
      </form></div>
  </section>;
}
