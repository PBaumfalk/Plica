"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function CopyButton({ text, label = "Kopieren", className, variant = "secondary" }: { text: string; label?: string; className?: string; variant?: "secondary" | "primary" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Kopiert" : label}
    </Button>
  );
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper-2">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <CopyButton text={code} className="h-6 px-2 text-[12px]" />
      </div>
      <pre className={cn("overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-2")}>{code}</pre>
    </div>
  );
}
