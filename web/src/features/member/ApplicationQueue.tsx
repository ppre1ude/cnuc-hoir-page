"use client";

import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api";
import { getSession } from "../auth/session";
import { approveApplication, getApplications, rejectApplication, type ApplicationPage } from "./adminMembers";

export function ApplicationQueue() {
  const [data, setData] = useState<ApplicationPage | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession().then(async (session) => {
      if (!session.admin || session.status !== "APPROVED") {
        if (alive) setError("운영진만 신청 목록을 볼 수 있습니다.");
        return;
      }
      if (alive) setAuthorized(true);
      const result = await getApplications(page);
      if (alive) setData(result);
    }).catch(() => { if (alive) setError("신청 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page]);

  async function update(id: number, action: () => Promise<void>) {
    if (busy !== null) return;
    setBusy(id);
    setError("");
    try {
      await action();
      setData(await getApplications(page));
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.status === 409
        ? "이미 처리된 신청입니다. 목록을 새로 확인해 주세요."
        : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h1>가입 신청 관리</h1>
      <p>이메일 확인을 마친 신청자입니다. 보유 명단과 대조한 뒤 처리해 주세요.</p>
      {error && <p role="alert">{error}</p>}
      {authorized && !data && <p role="status">신청 목록을 불러오는 중입니다.</p>}
      {data?.items.length === 0 && <p>승인 대기 신청이 없습니다.</p>}
      {data?.items.map((item) => <ApplicationRow key={item.id} item={item} busy={busy === item.id}
        onApprove={(type) => update(item.id, () => approveApplication(item.id, type))}
        onReject={(reason) => update(item.id, () => rejectApplication(item.id, reason))} />)}
      {data && data.total > data.size && <nav aria-label="신청 목록 페이지">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page + 1} / {Math.ceil(data.total / data.size)}</span>
        <button type="button" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>다음</button>
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
  return <article>
    <h2>{item.name}</h2>
    <p>{item.email}</p>
    <p>신청일: {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(item.createdAt))}</p>
    <label htmlFor={`type-${item.id}`}>{item.name} 단원 구분</label>
    <select id={`type-${item.id}`} value={type} onChange={(event) => setType(event.target.value as "ACTIVE" | "OB")}>
      <option value="ACTIVE">활동 단원</option>
      <option value="OB">OB</option>
    </select>
    <button type="button" disabled={busy} onClick={() => onApprove(type)}>{item.name} 승인</button>
    <label htmlFor={`reason-${item.id}`}>{item.name} 반려 이유</label>
    <textarea id={`reason-${item.id}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
    <button type="button" disabled={busy || !reason.trim()} onClick={() => onReject(reason.trim())}>{item.name} 반려</button>
  </article>;
}
