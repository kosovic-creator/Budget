"use client";

import { Fingerprint, KeyRound, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
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
  const [showRecovery, setShowRecovery] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  function passkeyName() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? "iPhone Face ID"
      : "Passkey ovog uređaja";
  }

  async function registerPasskey() {
    setIsPending(true);
    setMessage("");

    if (!("PublicKeyCredential" in window)) {
      setMessage("Ovaj preglednik ne podržava passkey. Prijavite se lozinkom na podržanom uređaju.");
      setIsPending(false);
      return;
    }

    const result = await authClient.passkey.addPasskey({
      name: passkeyName(),
      authenticatorAttachment: "platform",
    });

    if (result.error) {
      setMessage(`Nalog je sačuvan, ali zaštita ovog uređaja nije dodata: ${errorMessage(result.error)}`);
      setIsPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

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

    setAccountCreated(true);
    setIsPending(false);
    await registerPasskey();
  }

  async function signInWithPasskey() {
    setIsPending(true);
    setMessage("");

    if (!("PublicKeyCredential" in window)) {
      setMessage("Ovaj preglednik ne podržava prijavu Face ID-em ili passkey-em.");
      setIsPending(false);
      return;
    }

    const result = await authClient.signIn.passkey();
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

    setMessage("Prijava je uspjela. Potvrdite naredni prozor da uključite Face ID na ovom iPhoneu.");
    await registerPasskey();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f5f7] px-4 py-8 text-[#202124]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#e2e4e6] bg-white p-6 shadow-sm sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#202124] text-white">
          <WalletCards size={23} />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          {setupRequired ? "Zaštiti svoje finansije" : "Dobro došli nazad"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#777b82]">
          {setupRequired
            ? "Napravite vlasnički nalog, a zatim zaštitite uređaj Face ID-em, otiskom prsta ili šifrom uređaja."
            : "Na novom iPhoneu se prvo prijavite rezervnom lozinkom. Aplikacija će zatim uključiti Face ID za naredne prijave."}
        </p>

        {setupRequired && !accountCreated ? (
          <form onSubmit={setupOwner} className="mt-6 space-y-4">
            <AuthField label="Ime" name="name" autoComplete="name" placeholder="Vaše ime" />
            <AuthField label="Email" name="email" type="email" autoComplete="email" placeholder="ime@primjer.com" />
            <AuthField label="Rezervna lozinka" name="password" type="password" autoComplete="new-password" minLength={10} placeholder="Najmanje 10 znakova" />
            <button disabled={isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#202124] text-sm font-bold text-white disabled:opacity-60">
              <ShieldCheck size={18} /> {isPending ? "Podešavanje..." : "Napravi nalog i zaštiti uređaj"}
            </button>
          </form>
        ) : setupRequired && accountCreated ? (
          <div className="mt-6 space-y-3">
            <button onClick={registerPasskey} disabled={isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#202124] text-sm font-bold text-white disabled:opacity-60">
              <Fingerprint size={20} /> {isPending ? "Čekanje potvrde..." : "Pokušaj ponovo zaštititi ovaj uređaj"}
            </button>
            <Link href="/" className="flex h-11 items-center justify-center text-sm font-semibold text-[#686b70]">Nastavi i podesi kasnije</Link>
          </div>
        ) : (
          <div className="mt-6">
            <button onClick={signInWithPasskey} disabled={isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#202124] text-sm font-bold text-white disabled:opacity-60">
              <Fingerprint size={21} /> {isPending ? "Čekanje potvrde..." : "Otključaj Face ID-em ili passkey-em"}
            </button>

            <button onClick={() => { setShowRecovery(!showRecovery); setMessage(""); }} className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-xs font-semibold text-[#777b82]">
              <KeyRound size={15} /> {showRecovery ? "Sakrij rezervnu prijavu" : "Prijava rezervnom lozinkom"}
            </button>

            {showRecovery && (
              <form onSubmit={signInWithPassword} className="mt-3 space-y-4 border-t border-[#eceeef] pt-5">
                <AuthField label="Email" name="email" type="email" autoComplete="username webauthn" placeholder="ime@primjer.com" />
                <AuthField label="Lozinka" name="password" type="password" autoComplete="current-password webauthn" placeholder="Vaša rezervna lozinka" />
                <button disabled={isPending} className="h-11 w-full rounded-xl border border-[#dfe1e3] text-sm font-bold disabled:opacity-60">
                  Prijavi se i uključi Face ID
                </button>
              </form>
            )}
          </div>
        )}

        {message && <p role="alert" className="mt-4 rounded-xl bg-[#f7eeee] px-4 py-3 text-sm text-[#9b3d3d]">{message}</p>}
        <p className="mt-6 text-xs leading-5 text-[#9a9da2]">Face ID ostaje na vašem iPhoneu. Za novi uređaj potrebna je jednokratna prijava rezervnom lozinkom.</p>
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
    <label className="block text-xs font-semibold text-[#686b70]">
      {label}
      <input {...props} required className="mt-2 h-11 w-full rounded-xl border border-[#e2e4e6] px-3 text-sm outline-none focus:border-[#919b93]" />
    </label>
  );
}
