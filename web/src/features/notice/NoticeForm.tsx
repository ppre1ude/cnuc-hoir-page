"use client";

import { BackLink, Button, Feedback, Field, Form, Input, PageHeader, Panel, StatusBadge, Textarea } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { createNotice, updateNotice, type AdminPollView, type Notice, type NoticeInput, type PollInput } from "./notices";
import { clearDraft, emptyDraft, isEmptyDraft, readDraft, writeDraft, type Draft } from "./noticeDraft";
import { NoticePollChoice } from "./NoticePollChoice";
import { NoticePollResults } from "./NoticePollResults";
import styles from "../member/AdminPages.module.css";

type Props =
  | { mode: "new" }
  | { mode: "edit"; notice: Notice; poll: AdminPollView | null; pollUnknown?: boolean; returnTo: string; onSaved: (notice: Notice) => void };

// 투표 칸을 서버가 받는 꼴로 바꿉니다. 마감 시각은 한국 시간으로 적은 값입니다.
function pollOf(form: Draft): PollInput | undefined | "missing" | "invalid" {
  if (form.poll === "none") return undefined;
  if (!form.pollQuestion.trim() || !form.firstOption.trim() || !form.secondOption.trim()) return "missing";
  const closesAt = new Date(`${form.pollClosesAt}:00+09:00`);
  if (!form.pollClosesAt || Number.isNaN(closesAt.getTime())) return "invalid";
  return { question: form.pollQuestion.trim(), firstOption: form.firstOption.trim(), secondOption: form.secondOption.trim(), closesAt: closesAt.toISOString() };
}

function saveError(caught: unknown) {
  return caught instanceof ApiRequestError && ["INVALID_POLL", "POLL_EXISTS"].includes(caught.code)
    ? caught.message : "공지를 저장하지 못했습니다.";
}

const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(value));
const unpublishPrompt = "이 공지를 초안으로 내리면 단원에게 보이지 않습니다. 다시 게시하면 게시일이 새로 정해져 목록 맨 위로 올라갑니다. 계속할까요?";

// 새 공지 작성과 공지 수정이 함께 쓰는 폼입니다. 게시 여부는 체크박스가 아니라 맨 아래 어느 버튼을 누르는지로 정합니다.
// 작성은 저장 뒤 목록으로 돌아가고 임시 저장을 씁니다. 수정은 이 화면에 머물며 결과를 알리고 임시 저장을 쓰지 않습니다.
export function NoticeForm(props: Props) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const [initial] = useState<Draft>(() => editing ? { ...emptyDraft, title: props.notice.title, body: props.notice.body } : readDraft());
  const [form, setForm] = useState<Draft>(initial);
  const [restored, setRestored] = useState(() => !editing && !isEmptyDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  // 누른 버튼이 정한 게시 여부. null은 "저장"으로 지금 상태를 유지한다는 뜻입니다. 제출 이벤트의 submitter 대신 클릭에서 적어 둡니다.
  const publishRef = useRef<boolean | null>(null);
  const update = (patch: Partial<Draft>) => setForm((value) => ({ ...value, ...patch }));

  useEffect(() => { if (!editing) writeDraft(form); }, [editing, form]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const poll = pollOf(form);
    if (poll === "missing") { setError("투표 질문과 선택지를 적어 주세요."); return; }
    if (poll === "invalid") { setError("투표 마감 시각을 확인해 주세요."); return; }
    const published = publishRef.current ?? (editing && props.notice.published);
    const input: NoticeInput = { title: form.title.trim(), body: form.body, published, ...(poll ? { poll } : {}) };
    setBusy(true);
    setError("");
    setSaved("");
    try {
      if (!editing) {
        await createNotice(input);
        clearDraft();
        router.push(`/admin/notices?done=${published ? "published" : "draft"}`);
        return;
      }
      const result = await updateNotice(props.notice.id, input);
      setSaved(publishRef.current === null ? "저장했습니다." : published ? "게시했습니다." : "초안으로 내렸습니다.");
      if (poll) update({ poll: "none", pollQuestion: "", pollClosesAt: "" });
      setBusy(false);
      props.onSaved(result);
    } catch (caught) {
      // 작성 화면은 성공하면 목록으로 떠나므로 busy를 풀지 않고, 실패했을 때만 다시 누를 수 있게 풉니다.
      setError(saveError(caught));
      setBusy(false);
    }
  }

  // 버튼마다 제자리 화살표 함수로 적습니다. 함수를 돌려주는 함수를 렌더 중에 부르면 ref 접근 규칙에 걸립니다.
  function unpublish(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(unpublishPrompt)) { event.preventDefault(); return; }
    publishRef.current = false;
  }

  const empty = !form.title.trim() || !form.body.trim();
  const disabled = busy || empty;
  return <section className={ui.page}>
    <BackLink href={editing ? props.returnTo : "/admin/notices"}>← 공지 관리로</BackLink>
    <PageHeader title={editing ? "공지 수정" : "새 공지 작성"} actions={editing && <>
      <StatusBadge tone={props.notice.published ? "neutral" : "attention"}>{props.notice.published ? "게시" : "초안"}</StatusBadge>
      {props.notice.publishedAt && <time className={styles.time} dateTime={props.notice.publishedAt}>게시일 {date(props.notice.publishedAt)}</time>}
    </>} />
    {restored && <div className={styles.restored}>
      <Feedback tone="success">작성 중이던 공지를 되살렸습니다.</Feedback>
      <Button variant="ghost" size="small" type="button" onClick={() => { clearDraft(); setForm(emptyDraft); setRestored(false); }}>지우기</Button>
    </div>}
    {saved && <Feedback tone="success">{saved}</Feedback>}
    <Panel><Form onSubmit={save} noValidate>
      <Field id="notice-title" label="제목">
        <Input value={form.title} onChange={(event) => update({ title: event.target.value })} maxLength={200} required />
      </Field>
      <Field id="notice-body" label="본문" hint="주소를 적으면 단원 화면에서 링크가 됩니다.">
        <Textarea value={form.body} onChange={(event) => update({ body: event.target.value })} maxLength={10000} rows={10} required />
      </Field>
      {/* 투표를 못 받았을 때는 있는지 모르는 투표를 또 붙이지 않게 묶음을 숨깁니다. */}
      {editing && props.poll ? <NoticePollResults view={props.poll} /> : editing && props.pollUnknown ? null : <NoticePollChoice value={form} onChange={update} />}
      {error && <Feedback tone="error">{error}</Feedback>}
      <div className={styles.actions}>
        {!editing && <>
          <Button variant="secondary" type="submit" disabled={disabled} onClick={() => { publishRef.current = false; }}>초안으로 저장</Button>
          <Button variant="primary" type="submit" disabled={disabled} onClick={() => { publishRef.current = true; }}>게시하기</Button>
        </>}
        {editing && !props.notice.published && <>
          <Button variant="secondary" type="submit" disabled={disabled} onClick={() => { publishRef.current = null; }}>저장</Button>
          <Button variant="primary" type="submit" disabled={disabled} onClick={() => { publishRef.current = true; }}>게시하기</Button>
        </>}
        {editing && props.notice.published && <>
          <Button variant="primary" type="submit" disabled={disabled} onClick={() => { publishRef.current = null; }}>저장</Button>
          <Button variant="secondary" type="submit" disabled={disabled} onClick={unpublish}>초안으로 내리기</Button>
        </>}
      </div>
    </Form></Panel>
  </section>;
}
