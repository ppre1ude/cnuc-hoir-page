import type { ComponentProps, ReactNode } from "react";
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
