import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Server Component that injects the early theme initialization script.
 *
 * Kept strictly as a Server Component (no "use client") so that the script tag
 * is only emitted into the initial server HTML stream to prevent theme flashing,
 * and is never re-rendered by React's client reconciler (which triggers
 * React 19's "Encountered a script tag while rendering React component" error).
 */
export function ThemeInitScript() {
  const source = `!function(){try{var k="${THEME_STORAGE_KEY}",p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var s=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",t=p==="system"?s:p,r=document.documentElement;r.classList.toggle("dark",t==="dark");r.classList.toggle("light",t==="light");r.dataset.theme=t;r.dataset.themePreference=p;r.style.colorScheme=t}catch(e){}}();`;

  return <script dangerouslySetInnerHTML={{ __html: source }} suppressHydrationWarning />;
}
