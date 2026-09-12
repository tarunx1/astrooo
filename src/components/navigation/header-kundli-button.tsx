"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeaderKundliButton() {
  const pathname = usePathname();
  const isKundliPage = pathname === "/kundli";

  return (
    <Button
      aria-current={isKundliPage ? "page" : undefined}
      className={cn(
        "min-h-10 px-4 py-2",
        isKundliPage && "border-premium/45 bg-premium/10 text-premium hover:bg-premium/15",
      )}
      href="/kundli"
      variant="secondary"
    >
      Generate Kundli
    </Button>
  );
}
