"use client";

import { Button, Facts, Feedback, Field, List, PageHeader, Pagination, Panel, RowButton, Section, SkeletonRows, Textarea } from "../../components/ui";
import ui from "../../components/ui/ui.module.css";

import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api";
import { approveApplication, getApplications, rejectApplication, type ApplicationItem, type ApplicationPage } from "./adminMembers";
import { partLabel, rosterDetail } from "./roles";
import { memberTypeLabel } from "./MemberRoles";
import styles from "./AdminPages.module.css";

export function ApplicationQueue() {
  const [data, setData] = useState<ApplicationPage | null>(null);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  // undefined는 아직 고르지 않아 맨 위 신청자를 보이는 상태, null은 좁은 화면에서 목록으로 돌아간 상태입니다.
  const [selected, setSelected] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getApplications(page).then((result) => {
      if (!alive) return;
      if (page > 0 && result.items.length === 0 && result.total <= page * result.size) {
        setData(null);
        setPage(Math.max(0, Math.ceil(result.total / result.size) - 1));
      } else setData(result);
    }).catch(() => { if (alive) setError("신청 목록을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [page, retry]);

  async function update(id: number, action: () => Promise<void>) {
    if (busy !== null) return;
    setBusy(id);
    setError("");
    // 처리한 신청자의 목록 자리를 기억해 두었다가, 새 목록에서 같은 자리(맨 끝이었으면 새 끝)의 신청자를 고릅니다.
    const index = (data?.items ?? []).findIndex((item) => item.id === id);
    try {
      await action();
      const result = await getApplications(page);
      if (page > 0 && result.items.length === 0 && result.total <= page * result.size) {
        setData(null);
        setPage(Math.max(0, Math.ceil(result.total / result.size) - 1));
      } else {
        setData(result);
        if (index >= 0) setSelected(result.items[Math.min(index, result.items.length - 1)]?.id);
      }
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.status === 409
        ? "이미 처리된 신청입니다. 목록을 새로 확인해 주세요."
        : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  const items = data?.items ?? [];
  // 고른 신청자가 목록에 없으면 첫 신청자를 보입니다.
  const current = selected === null ? null : items.find((item) => item.id === selected) ?? items[0] ?? null;

  return (
    <section className={ui.page}>
      <PageHeader title="가입 승인" />
      <p className={ui.muted}>가입 신청자가 적은 이름, 기수, 파트와 구글 이메일이 실제 단원과 맞는지 확인한 뒤 승인해 주세요.</p>
      {error && <Feedback tone="error">{error}</Feedback>}
      {!data && error && <Button variant="secondary" type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>다시 시도</Button>}
      {!data && !error && <SkeletonRows count={3} label="신청 목록을 불러오는 중입니다." />}
      {data?.items.length === 0 && <p className={ui.muted}>승인 대기 신청이 없습니다.</p>}
      {items.length > 0 && <div className={styles.workspace} data-view={current ? "detail" : "list"}>
        <div className={styles.roster}>
          <List as="ul" aria-label="신청자 목록">
            {items.map((item) => <li key={item.id}>
              <RowButton aria-current={current?.id === item.id ? "true" : undefined} onClick={() => setSelected(item.id)}>
                <strong>{item.name}</strong>
                <span>{rosterDetail(item) || "정보 미입력"}</span>
              </RowButton>
            </li>)}
          </List>
          {data && data.total > data.size && <Pagination label="신청 목록 페이지" page={page} size={data.size} total={data.total} onChange={setPage} />}
        </div>
        <div className={styles.detail}>
          <Button variant="secondary" size="small" type="button" className={styles.toList} onClick={() => setSelected(null)}>목록으로</Button>
          <Panel>
          {current ? <ApplicationDetail key={current.id} item={current} busy={busy === current.id}
            onApprove={(type) => update(current.id, () => approveApplication(current.id, type))}
            onReject={(reason) => update(current.id, () => rejectApplication(current.id, reason))} />
            : <p className={styles.placeholder}>목록에서 신청자를 선택하세요.</p>}
          </Panel>
        </div>
      </div>}
    </section>
  );
}

const memberTypes = ["ACTIVE", "OB"] as const;

// 고른 신청자의 정보를 표로 보이고, 그 아래 한 상자에 승인과 반려를 모읍니다. 반려는 접어 두어 승인이 먼저 보입니다.
function ApplicationDetail({ item, busy, onApprove, onReject }: {
  item: ApplicationItem;
  busy: boolean;
  onApprove: (type: "ACTIVE" | "OB") => void;
  onReject: (reason: string) => void;
}) {
  const [type, setType] = useState<"ACTIVE" | "OB">("ACTIVE");
  const [reason, setReason] = useState("");
  return <Section title={item.name}>
    <Facts items={[
      { label: "파트", value: item.part ? partLabel[item.part] : "미입력" },
      { label: "기수", value: item.cohort == null ? "미입력" : `${item.cohort}기` },
      { label: "신청일", value: new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(item.createdAt)) },
      { label: "이메일", value: item.email },
    ]} />
    <div className={styles.approval}>
      <p className={ui.muted}>이름, 파트, 기수와 이메일이 아는 단원과 맞으면 단원 구분을 골라 승인해 주세요. 승인하면 본인은 다시 로그인해야 합니다.</p>
      <div className={styles.decision}>
        <span className={styles.fieldLabel}>단원 구분</span>
        <div className={styles.choice} role="group" aria-label={`${item.name} 단원 구분`}>
          {memberTypes.map((value) => <Button variant="secondary" key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}>{memberTypeLabel[value]}</Button>)}
        </div>
        <Button variant="primary" type="button" disabled={busy} aria-label={`${item.name} 승인`} onClick={() => onApprove(type)}>승인</Button>
      </div>
      <details className={styles.reject}>
        <summary aria-label={`${item.name} 가입 신청 반려`}>가입 신청 반려</summary>
        <div className={styles.rejectBody}>
          <Field id={`reason-${item.id}`} label="반려 이유">
            <Textarea aria-label={`${item.name} 반려 이유`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </Field>
          <div className={ui.actions}><Button variant="danger" type="button" disabled={busy || !reason.trim()} aria-label={`${item.name} 반려`} onClick={() => {
            if (window.confirm(`${item.name}의 가입 신청을 반려할까요? 반려한 계정은 단원 정보 관리 화면에서 반려를 취소할 수 있습니다.`)) onReject(reason.trim());
          }}>반려</Button></div>
        </div>
      </details>
    </div>
  </Section>;
}
