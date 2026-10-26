"use client";

import { useSyncExternalStore } from "react";
import { Feedback } from "./index";
import styles from "./ui.module.css";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// 연결이 끊기면 화면 아래에 알립니다. 각 영역의 "불러오지 못했습니다"가 서버 탓이 아님을 알리는 용도입니다.
// 서버에서 그릴 때는 연결된 것으로 봅니다.
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return <div className={styles.offline}>
    <Feedback tone="error">인터넷 연결이 끊겼습니다. 연결되면 다시 시도해 주세요.</Feedback>
  </div>;
}
