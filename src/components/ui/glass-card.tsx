"use client";

import { useRef, type CSSProperties, type ElementType, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import styles from "./glass-card.module.css";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  spotlight?: boolean;
  spotlightColor?: string;
  borderShineColor?: string;
  variant?: "glass" | "glass-raised" | "glass-premium" | "glass-subtle";
  as?: "div" | "a" | "article" | "section" | "main" | "header";
  href?: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
}

const variantStyles = {
  glass:
    "border-border bg-card/75 text-card-foreground backdrop-blur-xl shadow-[var(--shadow-md)] hover:border-border-strong",
  "glass-raised":
    "border-border-strong bg-surface-raised/80 text-card-foreground backdrop-blur-2xl shadow-[var(--shadow-lg)] hover:border-primary/45",
  "glass-premium":
    "border-premium/40 bg-surface/80 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(214,181,109,0.15)] hover:border-premium/70",
  "glass-subtle":
    "border-border bg-surface/50 backdrop-blur-md hover:border-border-strong",
};

export function GlassCard({
  children,
  className,
  spotlight = true,
  spotlightColor = "color-mix(in srgb, var(--premium) 15%, transparent)",
  borderShineColor = "color-mix(in srgb, var(--premium) 80%, transparent)",
  variant = "glass",
  as,
  href,
  prefetch,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  style,
  ...props
}: GlassCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);

  // A callback ref, because the rendered element may be an anchor (via Link) or
  // any of the allowed tags. One typed callback covers them all, where a
  // RefObject fixed to a single element type would not.
  const assignRef = (node: HTMLElement | null) => {
    cardRef.current = node;
  };
  const updatePointer = (e: MouseEvent<HTMLElement>) => {
    if (!spotlight || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  };

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    updatePointer(e);
    onMouseMove?.(e);
  };

  const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
    updatePointer(e);
    onMouseEnter?.(e);
  };

  const commonProps = {
    ref: assignRef,
    "data-glass-card": "",
    "data-spotlight": spotlight ? "true" : undefined,
    className: cn(
      "group relative overflow-hidden rounded-xl border transition-all duration-300",
      variantStyles[variant],
      styles.card,
      className
    ),
    onMouseEnter: handleMouseEnter,
    onMouseLeave,
    onMouseMove: handleMouseMove,
    style: { "--glow-color": spotlightColor, "--glow-border": borderShineColor, ...style } as CSSProperties,
    ...props,
  };

  const innerContent = (
    <>
      {spotlight && (
        <>
          <div aria-hidden="true" className={styles.glow} />
          <div aria-hidden="true" className={styles.shine} />
        </>
      )}

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={prefetch} {...commonProps}>
        {innerContent}
      </Link>
    );
  }

  const Tag: ElementType = as ?? "div";

  return <Tag {...commonProps}>{innerContent}</Tag>;
}
