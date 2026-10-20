import { Fragment, type ComponentProps, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./ui.module.css";

type ActionVariant = "primary" | "secondary" | "danger" | "ghost";
type ActionSize = "small" | "medium" | "large";
const join = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" ");

type ButtonProps = ComponentProps<"button"> & {
  variant?: ActionVariant | "unstyled";
  size?: ActionSize;
};

export function Button({ variant = "secondary", size = "medium", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={join(variant === "unstyled" ? styles.unstyled : styles.action,
    variant === "unstyled" ? undefined : styles[variant], styles[size], className)} {...props} />;
}

export function ActionLink({ variant = "primary", size = "medium", className, ...props }:
  ComponentProps<typeof Link> & { variant?: ActionVariant; size?: ActionSize }) {
  return <Link className={join(styles.action, styles[variant], styles[size], className)} {...props} />;
}

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input type={type} className={join(type === "checkbox" || type === "radio" ? undefined : styles.control, className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={join(styles.control, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={join(styles.control, className)} {...props} />;
}

export function PageHeader({ title, actions, className, id }:
  { title: ReactNode; actions?: ReactNode; className?: string; id?: string }) {
  return <header className={join(styles.pageHeader, className)}>
    <h1 className={styles.title} id={id}>{title}</h1>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </header>;
}

export function StatusBadge({ tone = "neutral", className, ...props }:
  ComponentProps<"span"> & { tone?: "positive" | "neutral" | "negative" }) {
  return <span className={join(styles.badge, styles[tone], className)} {...props} />;
}
export function Feedback({ tone = "success", className, ...props }:
  Omit<ComponentProps<"p">, "role"> & { tone?: "success" | "error" }) {
  return <p role={tone === "error" ? "alert" : "status"}
    className={join(styles.message, tone === "error" ? styles.error : undefined, className)} {...props} />;
}

export function BrandLogo({ mark = false, className, alt = "전남대학교 합창단", priority = false }:
  { mark?: boolean; className?: string; alt?: string; priority?: boolean }) {
  return <Image src={mark ? "/images/choir-mark.png" : "/images/choir-logo-horizontal.png"}
    width={mark ? 168 : 280} height={mark ? 130 : 61} alt={alt} priority={priority}
    className={join(styles.logo, mark ? styles.mark : undefined, className)} />;
}

// 내용 자리를 잡는 막대입니다. 화면 읽기 프로그램에는 감춥니다.
export function Skeleton({ className, width, height }: { className?: string; width?: string; height?: string }) {
  return <span aria-hidden="true" className={join(styles.skeleton, className)} style={{ width, height }} />;
}

// 목록 행 모양의 자리 표시입니다. 데이터를 받는 동안 목록 자리에 두며, label이 있으면 그 문구를 알립니다.
export function SkeletonRows({ count = 4, label, className }: { count?: number; label?: string; className?: string }) {
  return <div className={join(styles.skeletonRows, className)} role={label ? "status" : undefined}>
    {label && <span className={styles.srOnly}>{label}</span>}
    {Array.from({ length: count }, (_, index) => <div key={index} className={styles.skeletonRow} aria-hidden="true">
      <span className={styles.skeleton} style={{ width: `${48 + ((index * 17) % 36)}%` }} />
      <span className={styles.skeleton} style={{ width: "18%" }} />
    </div>)}
  </div>;
}

// 문장 끝의 마침표와 쉼표, 그리고 여는 괄호와 짝이 없는 닫는 괄호만 뗍니다. "Foo_(bar)"처럼 주소 안에서 짝이 맞는 괄호는 남깁니다.
function trimUrlEnd(part: string) {
  let url = part.replace(/[.,]+$/, "");
  const count = (char: string) => url.split(char).length - 1;
  while (url.endsWith(")") && count(")") > count("(")) url = url.slice(0, -1).replace(/[.,]+$/, "");
  return url;
}

export function Linkify({ text }: { text: string }) {
  // 주소 문자는 URL에 쓰는 영문 문자로만 잡습니다. "https://forms.gle/abc로 신청"처럼 붙여 쓴 조사가 링크에 들어가지 않게 하기 위해서입니다.
  return <>{text.split(/(https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)/).map((part, index) => {
    if (index % 2 === 0) return part;
    const url = trimUrlEnd(part);
    return <Fragment key={index}><a href={url} target="_blank" rel="noopener noreferrer" className={styles.textLink}>{url}</a>{part.slice(url.length)}</Fragment>;
  })}</>;
}
