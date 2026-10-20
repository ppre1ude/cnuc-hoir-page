"use client";

import { Button, Feedback, Input, Select } from "../../../components/ui";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout, saveApplication, type MemberSession, type Part } from "../../../features/auth/session";
import { partLabel, parts } from "../../../features/member/roles";
import { ApiRequestError } from "../../../lib/api";
import styles from "../layout.module.css";

export default function ApplicationStatusPage() {
  const router = useRouter();
  const [session, setSession] = useState<MemberSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSession().then((value) => {
      if (!active) return;
      if (value.status === "APPROVED") router.replace("/dashboard");
      else setSession(value);
    }).catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    try { await logout(); router.replace("/login"); }
    catch { setError("로그아웃하지 못했습니다."); }
  }

  const title = session?.status === "REJECTED" ? "가입 신청이 반려되었습니다"
    : session?.status === "INVITED" ? "계정 연결이 필요합니다" : "가입 승인 대기 중입니다";

  return <>
    <h1>{session ? title : "계정 확인 중"}</h1>
    {session && <p>{session.name}님의 계정 상태입니다.</p>}
    {session?.email && <p>{session.email} 계정으로 로그인했습니다. 운영진에게 알려 준 구글 계정이 아니면 로그아웃한 뒤 그 계정으로 다시 로그인해 주세요.</p>}
    {session?.status === "APPROVAL_PENDING" && <>
      <p>Gmail이 아닌 주소로 만든 구글 계정은 자동 승인 명단에 있어도 운영진이 직접 승인해야 합니다. 오래 걸리면 운영진에게 로그인했다고 알려 주세요.</p>
      <p>운영진이 승인한 뒤 다시 로그인하면 결과를 확인할 수 있습니다.</p>
      <ApplicationForm session={session} onSaved={setSession} />
    </>}
    {session && <div className={styles.actions}>
      {session.status === "APPROVAL_PENDING" && <Button variant="secondary" type="button" onClick={signOut}>다시 로그인해 확인</Button>}
      <Button variant="secondary" type="button" onClick={signOut}>로그아웃</Button>
    </div>}
    {error && <Feedback tone="error">{error}</Feedback>}
  </>;
}

function ApplicationForm({ session, onSaved }: { session: MemberSession; onSaved: (session: MemberSession) => void }) {
  const [name, setName] = useState(session.name);
  const [cohort, setCohort] = useState(session.cohort == null ? "" : String(session.cohort));
  const [part, setPart] = useState<Part | "">(session.part ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !part) return;
    setSaving(true);
    setResult(null);
    try {
      onSaved(await saveApplication({ name: name.trim(), cohort: Number(cohort), part }));
      setResult({ tone: "success", text: "저장했습니다. 운영진이 확인하면 승인됩니다." });
    } catch (caught) {
      setResult({ tone: "error", text: caught instanceof ApiRequestError ? caught.message : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSaving(false);
    }
  }

  return <form className={styles.form} onSubmit={submit} aria-labelledby="application-title">
    <h2 id="application-title">가입 정보</h2>
    <p>운영진이 누구인지 알아볼 수 있게 실제 이름과 기수, 파트를 적어 주세요. 승인 전까지 언제든 고칠 수 있습니다.</p>
    <div className={styles.field}>
      <label htmlFor="application-name">이름</label>
      <Input id="application-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} autoComplete="name" />
    </div>
    <div className={styles.field}>
      <label htmlFor="application-cohort">기수</label>
      <Input id="application-cohort" type="number" inputMode="numeric" min={1} max={99} value={cohort} onChange={(event) => setCohort(event.target.value)} required />
    </div>
    <div className={styles.field}>
      <label htmlFor="application-part">파트</label>
      <Select id="application-part" value={part} onChange={(event) => setPart(event.target.value as Part | "")} required>
        <option value="" disabled>파트를 고르세요</option>
        {parts.map((value) => <option key={value} value={value}>{partLabel[value]}</option>)}
      </Select>
    </div>
    <div className={styles.actions}><Button variant="primary" type="submit" disabled={saving}>가입 정보 저장</Button></div>
    {result && <Feedback tone={result.tone}>{result.text}</Feedback>}
  </form>;
}
