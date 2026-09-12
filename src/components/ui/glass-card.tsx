"use client";

import { useRef, useState, type ElementType, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
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
  spotlightColor = "rgba(101, 215, 255, 0.12)",
  borderShineColor = "rgba(255, 255, 255, 0.35)",
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (spotlight && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    onMouseMove?.(e);
  };

  const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
    setIsHovered(true);
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
    setIsHovered(false);
    onMouseLeave?.(e);
  };

  const commonProps = {
    ref: assignRef,
    "data-glass-card": "",
    className: cn(
      "group relative overflow-hidden rounded-xl border transition-all duration-300",
      variantStyles[variant],
      className
    ),
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseMove: handleMouseMove,
    style,
    ...props,
  };

  const innerContent = (
    <>
      {/* Background Spotlight Radial Glow */}
      {spotlight && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-700 ease-out"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(750px circle at ${mousePos.x}px ${mousePos.y}px, ${spotlightColor}, rgba(75, 123, 255, 0.03) 35%, rgba(214, 181, 109, 0.01) 65%, transparent 100%)`,
          }}
        />
      )}

      {/* Border Shine Effect on Cursor Hover */}
      {spotlight && (
        <div
          className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-700 ease-out"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(450px circle at ${mousePos.x}px ${mousePos.y}px, ${borderShineColor}, rgba(101, 215, 255, 0.12) 35%, transparent 75%)`,
            maskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
            padding: "1px",
          }}
        />
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
