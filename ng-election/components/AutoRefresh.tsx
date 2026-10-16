"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export function AutoRefresh({ everyMs = 10_000 }: { everyMs?: number }) { const r = useRouter(); useEffect(() => { const t = setInterval(() => r.refresh(), everyMs); return () => clearInterval(t); }, [r, everyMs]); return null; }
