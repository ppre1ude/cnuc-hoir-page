"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ActionLink } from "../../components/ui";
import { onWriteCompleted } from "../../lib/api";
import { pollWhileVisible } from "../../lib/poll";
import { can } from "../auth/session";
import { useSessionState } from "../auth/SessionProvider";
import { getApplications } from "./adminMembers";
import styles from "./ApprovalReminder.module.css";

// 가입 승인 화면은 이미 그 자리이고, 현장 출석과 출석 관리는 연습장에서 휴대폰으로 급히 쓰는 화면이라 띠로 밀어 내리지 않습니다.
const HIDDEN = [/^\/admin\/applications$/, /^\/events\/\d+\/check-in$/, /^\/admin\/events\/\d+\/attendance$/];

// 가입 승인 권한이 있는 운영진에게 어느 화면에서든 승인 대기 인원을 알립니다. 두 레이아웃이 메뉴 다음에 둡니다.
// 가입 승인 화면과 같은 요청을 쓰므로 1분 기억이 공유되어, 띠를 누르면 그 화면이 새 요청 없이 그려집니다.
export function ApprovalReminder() {
  const { session } = useSessionState();
  const pathname = usePathname();
  const allowed = can(session, "APPROVE_APPLICATIONS");
  const hidden = HIDDEN.some((pattern) => pattern.test(pathname));
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!allowed || hidden) return;
    let alive = true;
    // 실패하면 조용히 넘어가고 다음 계기(경로 이동, 쓰기 완료, 1분 주기)에 다시 받습니다.
    const load = (fresh = false) => getApplications(0, fresh ? { cache: "reload" } : undefined)
      .then((result) => { if (alive) setCount(result.total); }).catch(() => undefined);
    void load();
    const stopWrite = onWriteCompleted(() => { void load(); });
    const stopPoll = pollWhileVisible(() => load(true), 60_000);
    return () => { alive = false; stopWrite(); stopPoll(); };
  }, [allowed, hidden, pathname]);

  if (!allowed || hidden || count === 0) return null;
  return <section aria-label="가입 승인 알림" className={styles.reminder}>
    <p><strong>가입 승인을 기다리는 단원이 {count}명 있어요.</strong></p>
    <ActionLink variant="primary" href="/admin/applications">승인하러 가기</ActionLink>
  </section>;
}
