"use client";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./home-experience.module.css";
export function HomeChapter({ children, tone = "quiet", reveal = "astrology" }: { children: ReactNode; tone?: "deep" | "quiet" | "surface"; reveal?: "astrology" | "report" | "commerce" | "portrait" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    node.dataset.reveal = "waiting";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.dataset.reveal = "shown"; observer.disconnect(); }
    }, { threshold: .06 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${styles.chapter} ${styles[tone]}`} data-kind={reveal}>{children}</div>;
}
