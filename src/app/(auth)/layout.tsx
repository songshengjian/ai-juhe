import { AuthArtwork } from "@/components/auth/auth-artwork";

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <AuthArtwork />
      <section className="flex min-h-screen items-center justify-center px-6 py-10 lg:min-h-0">
        {children}
      </section>
    </main>
  );
}
