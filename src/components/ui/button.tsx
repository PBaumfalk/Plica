import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-stamp text-stamp-ink hover:brightness-110 active:brightness-95 shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_2px_rgb(0_0_0/0.15)]",
  secondary: "bg-paper text-ink border border-line-strong hover:bg-paper-2 shadow-[0_1px_1px_rgb(0_0_0/0.04)]",
  ghost: "text-ink-2 hover:bg-desk-2 hover:text-ink",
  danger: "bg-bad text-white hover:brightness-110",
  subtle: "bg-stamp-soft text-stamp hover:bg-stamp-line/40",
} as const;

const sizes = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5 rounded-sm",
  md: "h-8 px-3 text-[13.5px] gap-2 rounded-md",
  lg: "h-10 px-4 text-[15px] gap-2 rounded-md",
  icon: "h-8 w-8 rounded-md justify-center",
  "icon-sm": "h-7 w-7 rounded-sm justify-center",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", asChild, loading, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 select-none items-center font-medium whitespace-nowrap transition-[background,filter,color,box-shadow] duration-150 disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <Spinner />}
          {children}
        </>
      )}
    </Comp>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
