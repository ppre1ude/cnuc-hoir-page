import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "../../components/ui";
import styles from "./layout.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={styles.page}>
    <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
      <BrandLogo alt="" priority />
    </Link>
    <main className={styles.content}>{children}</main>
  </div>;
}
