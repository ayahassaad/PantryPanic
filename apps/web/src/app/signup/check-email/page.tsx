import { Mascot } from "@/components/mascot";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16 text-center">
      <div className="wobble-a hand-shadow border-2 border-ink bg-cream-card p-8">
        <Mascot className="mx-auto mb-5 h-16 w-14" />
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
          Almost there
        </p>
        <h1 className="mb-4 font-display text-3xl font-bold text-ink">
          Check your email
        </h1>
        <p className="text-base text-ink-soft">
          We sent you a confirmation link. Click it to activate your account,
          then come back and log in.
        </p>
      </div>
    </main>
  );
}
