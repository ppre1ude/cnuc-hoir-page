"use client";

import { Button, Input, Select, Textarea, Feedback, PageHeader } from "../../components/ui";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { can, getSession } from "../auth/session";
import { createNotice, getAdminNoticePoll, getAdminNotices, updateNotice,
  type AdminPollView, type Notice, type NoticePage, type PollInput } from "./notices";
import styles from "../member/AdminPages.module.css";

export function NoticeEditor() {
  const router = useRouter();
  const [data, setData] = useState<NoticePage | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const [canEdit, setCanEdit] = useState(false);
  const [pollStatus, setPollStatus] = useState<"none" | "loading" | "exists" | "error">("none");
  const [adminPoll, setAdminPoll] = useState<AdminPollView | null>(null);
  const [pollRetry, setPollRetry] = useState(0);
  const [includePoll, setIncludePoll] = useState(false);
  const [pollPreset, setPollPreset] = useState<"attendance" | "agree" | "custom">("attendance");
  const [pollQuestion, setPollQuestion] = useState("");
  const [firstOption, setFirstOption] = useState("참석");
  const [secondOption, setSecondOption] = useState("불참");
  const [pollClosesAt, setPollClosesAt] = useState("");

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (!can(session, "MANAGE_EVENTS") || session.status !== "APPROVED") {
        if (alive) setCanEdit(false);
        if (alive) setError("운영진만 공지를 편집할 수 있습니다.");
        return;
      }
      if (alive) setCanEdit(true);
      const result = await getAdminNotices(page);
      if (alive) {
        setData(result);
        setListError("");
      }
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setListError("공지 목록을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [page, retry, router]);

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
    setIncludePoll(false);
    setPollPreset("attendance");
    setPollQuestion("");
    setFirstOption("참석");
    setSecondOption("불참");
    setPollClosesAt("");
    setTitle(notice.title);
    setBody(notice.body);
    setPublished(notice.published);
  }

  function clear() {
    setSelected(null);
    setPollStatus("none");
    setAdminPoll(null);
    setIncludePoll(false);
    setPollPreset("attendance");
    setPollQuestion("");
    setFirstOption("참석");
    setSecondOption("불참");
    setPollClosesAt("");
    setTitle("");
    setBody("");
    setPublished(false);
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
      clear();
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
    {canEdit && <div className={styles.grid}><div className={styles.list}>{visibleData && <>
      {visibleData.items.length === 0 && <p>작성된 공지가 없습니다.</p>}
      {visibleData.items.map((notice) => <Button variant="unstyled" className={styles.rowButton} type="button" key={notice.id} onClick={() => edit(notice)}>
        <strong>{notice.title}</strong><span>{notice.published ? "게시" : "초안"}</span>
      </Button>)}
      {visibleData.total > visibleData.size && <nav className={styles.pagination} aria-label="공지 관리 페이지">
        <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
        <span>{page + 1} / {Math.ceil(visibleData.total / visibleData.size)}</span>
        <Button variant="secondary" type="button" disabled={(page + 1) * visibleData.size >= visibleData.total} onClick={() => setPage(page + 1)}>다음</Button>
      </nav>}
    </>}</div>
      <form className={`${styles.panel} ${styles.form}`} onSubmit={save}>
        <h2>{selected ? "공지 수정" : "공지 작성"}</h2>
        <label htmlFor="notice-title">제목</label>
        <Input id="notice-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        <label htmlFor="notice-body">본문</label>
        <Textarea id="notice-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} required />
        <label className={styles.check} htmlFor="notice-published"><Input id="notice-published" type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> 게시</label>
        {pollStatus === "loading" && <p role="status">투표 정보를 불러오는 중입니다.</p>}
        {pollStatus === "error" && <Feedback tone="error">투표 정보를 불러오지 못했습니다.
          <Button variant="secondary" type="button" onClick={() => { setPollStatus("loading"); setPollRetry((value) => value + 1); }}>다시 시도</Button></Feedback>}
        {adminPoll && <section className={styles.pollDetails} aria-label="투표 결과">
          <h3>{adminPoll.poll.question}</h3>
          <p>마감 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(adminPoll.poll.closesAt))}</p>
          <p>{adminPoll.poll.firstOption} {adminPoll.poll.firstCount}명 · {adminPoll.poll.secondOption} {adminPoll.poll.secondCount}명</p>
          <h4>응답자</h4>
          {adminPoll.respondents.length === 0 && <p>아직 응답이 없습니다.</p>}
          <ul>{adminPoll.respondents.map((respondent) => <li key={respondent.memberId}>
            <span>{respondent.name} ({respondent.email})</span>
            <strong>{respondent.choice === 1 ? adminPoll.poll.firstOption : adminPoll.poll.secondOption}</strong>
          </li>)}</ul>
        </section>}
        {pollStatus === "none" && <>
          <label className={styles.check} htmlFor="notice-poll"><Input id="notice-poll" type="checkbox" checked={includePoll}
            onChange={(event) => setIncludePoll(event.target.checked)} /> 투표 추가</label>
          {includePoll && <div className={styles.pollFields}>
            <label htmlFor="poll-question">질문</label>
            <Input id="poll-question" value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} maxLength={200} required />
            <label htmlFor="poll-preset">선택지 형식</label>
            <Select id="poll-preset" value={pollPreset}
              onChange={(event) => { const next = event.target.value as "attendance" | "agree" | "custom";
                setPollPreset(next);
                if (next === "agree") { setFirstOption("찬성"); setSecondOption("반대"); }
                if (next === "attendance") { setFirstOption("참석"); setSecondOption("불참"); } }}>
              <option value="attendance">참석 / 불참</option><option value="agree">찬성 / 반대</option><option value="custom">직접 입력</option>
            </Select>
            <label htmlFor="poll-first">첫 번째 선택지</label>
            <Input id="poll-first" value={firstOption} onChange={(event) => { setFirstOption(event.target.value); setPollPreset("custom"); }} maxLength={80} required />
            <label htmlFor="poll-second">두 번째 선택지</label>
            <Input id="poll-second" value={secondOption} onChange={(event) => { setSecondOption(event.target.value); setPollPreset("custom"); }} maxLength={80} required />
            <label htmlFor="poll-closes">마감 시각 (한국 시간)</label>
            <Input id="poll-closes" type="datetime-local" value={pollClosesAt} onChange={(event) => setPollClosesAt(event.target.value)} required />
            <p>등록한 투표의 질문과 선택지는 변경할 수 없습니다.</p>
            <p>참석 응답은 행사 출석 기록과 별도로 관리됩니다.</p>
          </div>}
        </>}
        <div className={styles.actions}><Button variant="primary" type="submit" disabled={busy || !title.trim() || !body.trim()}>저장</Button>
        {selected && <Button variant="secondary" type="button" onClick={clear}>새 공지</Button>}</div>
      </form></div>}
  </section>;
}
