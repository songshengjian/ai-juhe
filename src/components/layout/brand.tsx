import { cn } from "@/lib/utils";

interface BrandProps {
  className?: string;
  inverse?: boolean;
}

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_30%_22%,#8ff7ff,transparent_26%),linear-gradient(135deg,#11d7b5,#3268ff_55%,#8a5cff)] shadow-[0_14px_34px_rgba(17,215,181,.24),inset_0_1px_0_rgba(255,255,255,.28)]",
        inverse && "border-white/20"
      )}
    >
      <span className="absolute inset-[6px] rounded-full border border-white/50 bg-black/12" />
      <span className="absolute h-12 w-3 rotate-45 bg-white/35 blur-[1px]" />
      <svg viewBox="0 0 32 32" className="relative h-6 w-6 text-white drop-shadow">
        <path
          fill="currentColor"
          d="M16 4.6 18.8 13 27.4 16 18.8 19 16 27.4 13.2 19 4.6 16 13.2 13 16 4.6Z"
        />
        <circle cx="16" cy="16" r="3.2" fill="#061014" opacity=".82" />
      </svg>
    </span>
  );
}

export function Brand({ className, inverse = false }: BrandProps) {
  return (
    <div className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <BrandMark inverse={inverse} />
      <span>镜刻</span>
    </div>
  );
}
