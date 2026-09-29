"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Reveal.module.css";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delayed?: boolean;
};

let sharedObserver: IntersectionObserver | null = null;

function getObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = "visible";
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
  }

  return sharedObserver;
}

export function Reveal({ children, className, delayed = false }: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
      return;
    }

    element.dataset.reveal = "pending";
    const observer = getObserver();
    observer.observe(element);
    return () => observer.unobserve(element);
  }, []);

  return (
    <div
      ref={elementRef}
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      data-delay={delayed ? "short" : undefined}
    >
      {children}
    </div>
  );
}
