"use client";

import { Button, Select, Textarea, Feedback, PageHeader } from "../../components/ui";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { can, getSession } from "../auth/session";
import { approveApplication, getApplications, rejectApplication, type ApplicationPage } from "./adminMembers";
import styles from "./AdminPages.module.css";

export function ApplicationQueue() {
  const router = useRouter();
  const [data, setData] = useState<ApplicationPage | null>(null);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (!can(session, "APPROVE_APPLICATIONS") || session.status !== "APPROVED") {
        if (alive) setError("운영진만 신청 목록을 볼 수 있습니다.");
        return;
      }
      if (alive) setAuthorized(true);
      const result = await getApplications(page);
      if (alive) {
        if (page > 0 && result.items.length === 0 && result.total <= page * result.size) {
          setData(null);
          setPage(Math.max(0, Math.ceil(result.total / result.size) - 1));
        } else setData(result);
      }
    }).catch((caught) => {
      if (!alive) return;
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setError("신청 목록을 불러오지 못했습니다.");
    });
    return () => { alive = false; };
  }, [page, retry, router]);

  async function update(id: number, action: () => Promise<void>) {
    if (busy !== null) return;
    setBusy(id);
    setError("");
    try {
      await action();
      const result = await getApplications(page);
      if (page > 0 && result.items.length === 0 && result.total <= page * result.size) {
        setData(null);
        setPage(Math.max(0, Math.ceil(result.total / result.size) - 1));
      } else setData(result);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) router.replace("/login");
      else setError(caught instanceof ApiRequestError && caught.status === 409
        ? "이미 처리된 신청입니다. 목록을 새로 확인해 주세요."
        : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.page}>
      <PageHeader title="가입 승인" />
      <p>구글 로그인 신청자의 이메일을 단원 명단과 대조해 주세요.</p>
      {error && <Feedback tone="error">{error}</Feedback>}
      {authorized && !data && error && <Button variant="secondary" type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button>}
      {authorized && !data && !error && <p role="status">신청 목록을 불러오는 중입니다.</p>}
      {data?.items.length === 0 && <p>승인 대기 신청이 없습니다.</p>}
      <div className={styles.list}>{data?.items.map((item) => <ApplicationRow key={item.id} item={item} busy={busy === item.id}
        onApprove={(type) => update(item.id, () => approveApplication(item.id, type))}
        onReject={(reason) => update(item.id, () => rejectApplication(item.id, reason))} />)}</div>
      {data && data.total > data.size && <nav className={styles.pagination} aria-label="신청 목록 페이지">
        <Button variant="secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
        <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
        <Button variant="secondary" type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</Button>
      </nav>}
    </section>
  );
}

function ApplicationRow({ item, busy, onApprove, onReject }: {
  item: NonNullable<ApplicationPage["items"]>[number];
  busy: boolean;
  onApprove: (type: "ACTIVE" | "OB") => void;
  onReject: (reason: string) => void;
}) {
  const [type, setType] = useState<"ACTIVE" | "OB">("ACTIVE");
  const [reason, setReason] = useState("");
  return <article className={styles.row}>
    <h2>{item.name}</h2>
    <p>{item.email}</p>
    <p>신청일: {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(item.createdAt))}</p>
    <div className={styles.fieldGroup}><label htmlFor={`type-${item.id}`}>{item.name} 단원 구분</label>
      <Select id={`type-${item.id}`} value={type} onChange={(event) => setType(event.target.value as "ACTIVE" | "OB")}>
        <option value="ACTIVE">활동 단원</option>
        <option value="OB">OB</option>
      </Select></div>
    <div className={styles.actions}><Button variant="primary" type="button" disabled={busy} onClick={() => onApprove(type)}>{item.name} 승인</Button></div>
    <div className={styles.fieldGroup}><label htmlFor={`reason-${item.id}`}>{item.name} 반려 이유</label>
      <Textarea id={`reason-${item.id}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></div>
    <div className={styles.actions}><Button variant="danger" type="button" disabled={busy || !reason.trim()} onClick={() => onReject(reason.trim())}>{item.name} 반려</Button></div>
  </article>;
}
