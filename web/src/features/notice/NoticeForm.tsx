"use client";

import { Button, Feedback, Input, PageHeader, Textarea } from "../../components/ui";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { createNotice, type NoticeInput, type PollInput } from "./notices";
import { clearDraft, emptyDraft, isEmptyDraft, readDraft, writeDraft, type Draft } from "./noticeDraft";
import { NoticePollChoice } from "./NoticePollChoice";
import styles from "../member/AdminPages.module.css";

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

// 새 공지 작성 화면입니다. 게시 여부는 체크박스가 아니라 맨 아래 두 버튼 중 어느 것을 누르는지로 정합니다.
export function NoticeForm({ mode }: { mode: "new" }) {
  const router = useRouter();
  const [initial] = useState(readDraft);
  const [form, setForm] = useState<Draft>(initial);
  const [restored, setRestored] = useState(() => !isEmptyDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 누른 버튼이 게시하기인지 초안으로 저장인지. 제출 이벤트의 submitter 대신 클릭에서 적어 둡니다.
  const publishRef = useRef(false);
  const update = (patch: Partial<Draft>) => setForm((value) => ({ ...value, ...patch }));

  useEffect(() => { writeDraft(form); }, [form]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const poll = pollOf(form);
    if (poll === "missing") { setError("투표 질문과 선택지를 적어 주세요."); return; }
    if (poll === "invalid") { setError("투표 마감 시각을 확인해 주세요."); return; }
    const published = publishRef.current;
    const input: NoticeInput = { title: form.title.trim(), body: form.body, published, ...(poll ? { poll } : {}) };
    setBusy(true);
    setError("");
    try {
      await createNotice(input);
      clearDraft();
      router.push(`/admin/notices?done=${published ? "published" : "draft"}`);
    } catch (caught) {
      setError(saveError(caught));
      setBusy(false);
    }
  }

  const empty = !form.title.trim() || !form.body.trim();
  return <section className={styles.page}>
    <Link className={styles.back} href="/admin/notices">← 공지 관리로</Link>
    <PageHeader title={mode === "new" ? "새 공지 작성" : "공지 수정"} />
    {restored && <div className={styles.restored}>
      <Feedback tone="success">작성 중이던 공지를 되살렸습니다.</Feedback>
      <Button variant="ghost" size="small" type="button" onClick={() => { clearDraft(); setForm(emptyDraft); setRestored(false); }}>지우기</Button>
    </div>}
    <form className={`${styles.detail} ${styles.form}`} onSubmit={save} noValidate>
      <label htmlFor="notice-title">제목</label>
      <Input id="notice-title" value={form.title} onChange={(event) => update({ title: event.target.value })} maxLength={200} required />
      <label htmlFor="notice-body">본문</label>
      <Textarea id="notice-body" value={form.body} onChange={(event) => update({ body: event.target.value })} maxLength={10000} rows={10} required />
      <p className={styles.hint}>주소를 적으면 단원 화면에서 링크가 됩니다.</p>
      <NoticePollChoice value={form} onChange={update} />
      {error && <Feedback tone="error">{error}</Feedback>}
      <div className={styles.actions}>
        <Button variant="secondary" type="submit" disabled={busy || empty} onClick={() => { publishRef.current = false; }}>초안으로 저장</Button>
        <Button variant="primary" type="submit" disabled={busy || empty} onClick={() => { publishRef.current = true; }}>게시하기</Button>
      </div>
    </form>
  </section>;
}
