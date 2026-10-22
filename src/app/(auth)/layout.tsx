import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pb-16 pt-[10vh]">
      <Logo className="mb-8" />
      <div className="w-full max-w-[420px] animate-rise">{children}</div>
    </main>
  );
}
