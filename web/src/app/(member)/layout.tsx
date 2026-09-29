import type { ReactNode } from "react";
import { MemberNavigation } from "../../features/member/MemberNavigation";
import styles from "./layout.module.css";

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <MemberNavigation />
    {children}
  </div>;
}
