import type { ReactNode } from "react";
import { MemberNavigation } from "../../features/member/MemberNavigation";
import styles from "./layout.module.css";

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#member-content">본문으로 건너뛰기</a>
    <MemberNavigation />
    {children}
  </div>;
}
