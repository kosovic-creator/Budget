"use client";

import { Fingerprint, ShieldCheck, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface SignInFormProps {
  setupRequired: boolean;
}

function errorMessage(error: { message?: string } | null | undefined) {
  return error?.message ?? "Nešto nije uspjelo. Pokušajte ponovo.";
}

export default function SignInForm({ setupRequired }: SignInFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  async function setupOwner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsPending(true);
    setMessage("");

    const result = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    if (result.error) {
      setMessage(errorMessage(result.error));
      setIsPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsPending(true);
    setMessage("");

    const result = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      rememberMe: true,
    });

    if (result.error) {
      setMessage("Email ili lozinka nijesu ispravni.");
      setIsPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function signInWithPasskey() {
    if (!window.isSecureContext || !("PublicKeyCredential" in window)) {
      setMessage("Za prijavu pomoću Face ID-a otvorite Budžet preko HTTPS-a u Safariju.");
      return;
    }
    setIsPending(true);
    setMessage("");
    try {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        setMessage("Prijava passkeyem nije uspjela. Ako ga još nemate, prijavite se lozinkom i uključite Face ID u Budžetu.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Prijava passkeyem nije dovršena. Pokušajte ponovo ili se prijavite lozinkom.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f8] px-4 py-8 text-zinc-900">
      <div className="w-full max-w-[420px] rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(24,24,27,0.08)] sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/15">
          <WalletCards size={23} />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          {setupRequired ? "Zaštiti svoje finansije" : "Dobro došli nazad"}
        </h1>
        {setupRequired ? (
          <form onSubmit={setupOwner} className="mt-6 space-y-4">
            <AuthField label="Ime" name="name" autoComplete="name" placeholder="Vaše ime" />
            <AuthField label="Email" name="email" type="email" autoComplete="email" placeholder="ime@primjer.com" />
            <AuthField label="Lozinka" name="password" type="password" autoComplete="new-password" minLength={10} placeholder="Najmanje 10 znakova" />
            <button disabled={isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-sm font-bold text-white shadow-lg shadow-zinc-900/15 transition active:scale-[0.98] disabled:opacity-60">
              <ShieldCheck size={18} /> {isPending ? "Podešavanje..." : "Napravi nalog"}
            </button>
          </form>
        ) : (
          <form onSubmit={signInWithPassword} className="mt-6 space-y-4">
            <AuthField label="Email" name="email" type="email" autoComplete="username" placeholder="ime@primjer.com" />
            <AuthField label="Lozinka" name="password" type="password" autoComplete="current-password" placeholder="Vaša lozinka" />
            <button disabled={isPending} className="h-12 w-full rounded-2xl border border-zinc-200 text-sm font-bold text-zinc-800 transition active:scale-[0.98] disabled:opacity-60">
              {isPending ? "Prijava…" : "Prijavi se"}
            </button>
          </form>
        )}

        {!setupRequired && (
          <button type="button" onClick={signInWithPasskey} disabled={isPending} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-3 text-sm font-bold text-white disabled:opacity-60">
            <Fingerprint size={19} aria-hidden /> Prijavi se pomoću Face ID-a / passkeya
          </button>
        )}
        {message && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>}
      </div>
    </main>
  );
}

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

function AuthField({ label, ...props }: AuthFieldProps) {
  return (
    <label className="block text-xs font-semibold text-zinc-600">
      {label}
      <input {...props} required className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-3 text-[16px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:text-sm" />
    </label>
  );
}
