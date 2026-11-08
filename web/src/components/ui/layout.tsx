import { cloneElement, type ComponentProps, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { Feedback } from "./index";
import ui from "./ui.module.css";
import styles from "./layout.module.css";

const join = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" ");

type SectionProps = {
  title: ReactNode; badge?: ReactNode; actions?: ReactNode; description?: ReactNode;
  level?: 2 | 3; id?: string; className?: string; children?: ReactNode;
  // 제목에 ref나 tabIndex처럼 초점을 옮길 때 필요한 속성을 줍니다.
  titleProps?: ComponentProps<"h2">;
};

// 소제목 한 덩어리. 제목 옆에 상태 배지, 오른쪽 끝에 동작, 아래에 설명 한 줄.
export function Section({ title, badge, actions, description, level = 2, id, className, children, titleProps }: SectionProps) {
  const Heading = level === 3 ? "h3" : "h2";
  return <section className={join(styles.section, className)} aria-labelledby={id}>
    <div className={styles.sectionHead}>
      <Heading {...titleProps} id={id ?? titleProps?.id} className={join(styles.sectionTitle, titleProps?.className)}>{title}</Heading>
      {badge}
      {actions && <div className={styles.sectionActions}>{actions}</div>}
    </div>
    {description && <p className={ui.muted}>{description}</p>}
    {children}
  </section>;
}

// 테두리 카드. 폼과 상세를 담고, 한 화면에 한 겹만 둡니다.
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={join(styles.panel, className)} {...props} />;
}

export function List({ as: Tag = "div", className, ...props }: HTMLAttributes<HTMLElement> & { as?: "ul" | "div" }) {
  return <Tag className={join(styles.list, className)} {...props} />;
}

export function Row({ as: Tag = "div", className, ...props }: HTMLAttributes<HTMLElement> & { as?: "div" | "li" | "article" }) {
  return <Tag className={join(styles.row, className)} {...props} />;
}

export function RowLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={join(styles.selectRow, className)} {...props} />;
}

export function RowButton({ className, type = "button", ...props }: ComponentProps<"button">) {
  return <button type={type} className={join(styles.selectRow, className)} {...props} />;
}

export function Form({ layout = "stack", className, ...props }: ComponentProps<"form"> & { layout?: "stack" | "inline" }) {
  return <form className={join(layout === "inline" ? styles.inlineForm : styles.form, className)} {...props} />;
}

type FieldProps = {
  id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; className?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: "true" }>;
};

// 라벨, 입력, 도움말, 오류 한 묶음. 입력에 id와 설명 연결을 붙여 줍니다.
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;
  return <div className={join(styles.field, className)}>
    <label htmlFor={id}>{label}</label>
    {cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? "true" : undefined })}
    {hint && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
    {error && <Feedback tone="error" id={`${id}-error`}>{error}</Feedback>}
  </div>;
}

export function Facts({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return <dl className={join(styles.facts, className)}>
    {items.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}

export function BackLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={join(styles.back, className)} {...props} />;
}

// 본문 곁에 두는 안내 상자라 aside로 그립니다.
export function Callout({ className, ...props }: ComponentProps<"aside">) {
  return <aside className={join(styles.callout, className)} {...props} />;
}
