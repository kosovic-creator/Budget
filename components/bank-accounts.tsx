"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addBankDeduction, deleteBankAccount, deleteBankDeduction, saveBankAccount } from "@/app/actions";
import type { BankAccount } from "@/lib/bank";

interface BankAccountsProps {
  initialAccounts: BankAccount[];
}

function money(value: number) {
  return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function BankAccounts({ initialAccounts }: BankAccountsProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const total = accounts.reduce((sum, account) => sum + account.amount - account.deductions.reduce((deductions, item) => deductions + item.amount, 0), 0);

  async function saveAccount(event: React.FormEvent<HTMLFormElement>, account?: BankAccount) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(account?.id ?? "new"); setMessage("");
    const result = await saveBankAccount({ id: account?.id, name: String(form.get("name") ?? ""), amount: Number(form.get("amount")), note: String(form.get("note") ?? "") });
    if (result.success) {
      setAccounts((current) => account ? current.map((item) => item.id === account.id ? { ...result.account, deductions: account.deductions } : item) : [...current, result.account]);
      setAdding(false); setMessage("Sačuvano.");
    } else setMessage(result.message);
    setBusy(null);
  }

  async function removeAccount(account: BankAccount) {
    if (!window.confirm(`Ukloniti „${account.name}“ i sve njegove odbitke?`)) return;
    setBusy(account.id);
    const result = await deleteBankAccount(account.id);
    if (result.success) setAccounts((current) => current.filter((item) => item.id !== account.id)); else setMessage(result.message);
    setBusy(null);
  }

  async function addDeduction(event: React.FormEvent<HTMLFormElement>, account: BankAccount) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(`deduction-${account.id}`); setMessage("");
    const result = await addBankDeduction({ accountId: account.id, description: String(form.get("description") ?? ""), amount: Number(form.get("deductionAmount")) });
    if (result.success) {
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, deductions: [...item.deductions, result.deduction] } : item));
      formElement.reset();
    } else setMessage(result.message);
    setBusy(null);
  }

  async function removeDeduction(accountId: string, deductionId: string) {
    setBusy(deductionId);
    const result = await deleteBankDeduction(deductionId);
    if (result.success) setAccounts((current) => current.map((item) => item.id === accountId ? { ...item, deductions: item.deductions.filter((deduction) => deduction.id !== deductionId) } : item)); else setMessage(result.message);
    setBusy(null);
  }

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5 md:px-8 md:py-7 lg:px-10">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(24,24,27,0.035)] md:p-6">
        <div>
          <div><h2 className="text-xl font-bold tracking-tight text-zinc-900">Banka</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Računi, napomene i planirani odbici.</p></div>
        </div>

        <div className="mt-5 space-y-4">
          {accounts.length === 0 ? <p className="rounded-xl bg-[#f5f6f7] p-5 text-sm text-[#85888d]">Još nema bankovnih stavki.</p> : accounts.map((account, index) => {
            if (index > 0) {
              return (
                <form key={account.id} onSubmit={(event) => saveAccount(event, account)} className="grid gap-3 rounded-2xl border border-zinc-200/80 p-4 md:grid-cols-[1fr_180px_1fr_auto_auto] md:items-end">
                  <Field label="Naziv" name="name" defaultValue={account.name} />
                  <Field label="Iznos (€)" name="amount" type="number" min="0" step="0.01" defaultValue={account.amount} />
                  <Field label="Napomena" name="note" defaultValue={account.note} required={false} />
                  <button disabled={busy === account.id} className="h-12 rounded-xl border border-zinc-200 px-4 text-sm font-bold text-zinc-700 transition active:scale-[0.98] disabled:opacity-50">Sačuvaj</button>
                  <button type="button" onClick={() => removeAccount(account)} disabled={busy === account.id} aria-label={`Ukloni ${account.name}`} className="grid h-12 w-full place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 md:w-12"><Trash2 size={17} /></button>
                </form>
              );
            }
            const deductions = account.deductions.reduce((sum, item) => sum + item.amount, 0);
            return (
              <article key={account.id} className="rounded-2xl border border-zinc-200/80 p-4 shadow-[0_2px_10px_rgba(24,24,27,0.025)]">
                <form onSubmit={(event) => saveAccount(event, account)} className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto_auto] md:items-end">
                  <Field label="Naziv" name="name" defaultValue={account.name} />
                  <Field label="Iznos (€)" name="amount" type="number" min="0" step="0.01" defaultValue={account.amount} />
                  <Field label="Napomena" name="note" defaultValue={account.note} required={false} />
                  <button disabled={busy === account.id} className="h-12 rounded-xl border border-zinc-200 px-4 text-sm font-bold text-zinc-700 transition active:scale-[0.98] disabled:opacity-50">Sačuvaj</button>
                  <button type="button" onClick={() => removeAccount(account)} disabled={busy === account.id} aria-label={`Ukloni ${account.name}`} className="grid h-12 w-full place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 md:w-12"><Trash2 size={17} /></button>
                </form>

                <div className="mt-4 border-t border-[#eceeef] pt-4">
                  <p className="text-sm font-bold">Planirani odbici</p>
                  {account.deductions.map((deduction) => (
                    <div key={deduction.id} className="mt-2 flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{deduction.description}</span><strong className="shrink-0 text-sm">−{money(deduction.amount)} €</strong>
                      <button type="button" onClick={() => removeDeduction(account.id, deduction.id)} disabled={busy === deduction.id} aria-label={`Ukloni odbitak ${deduction.description}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <form onSubmit={(event) => addDeduction(event, account)} className="mt-3 grid gap-3 min-[430px]:grid-cols-[1fr_140px_auto]">
                    <Field label="Opis odbitka" name="description" />
                    <Field label="Iznos odbitka (€)" name="deductionAmount" type="number" min="0.01" step="0.01" />
                    <button disabled={busy === `deduction-${account.id}`} className="h-12 self-end rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50">Dodaj odbitak</button>
                  </form>
                   <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="text-sm font-semibold text-emerald-950">{account.name} nakon odbitaka</span><strong className="text-emerald-950">{money(account.amount - deductions)} €</strong></div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-4 text-white shadow-lg shadow-zinc-900/10"><span className="font-semibold">Nakon odbitaka + dodatne stavke</span><strong className="text-xl">{money(total)} €</strong></div>
        <button type="button" onClick={() => setAdding((value) => !value)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm font-bold text-zinc-800 transition active:scale-[0.98] min-[390px]:w-auto"><Plus size={16} /> {adding ? "Otkaži" : "Dodaj stavku"}</button>
        {adding ? <AccountForm onSubmit={(event) => saveAccount(event)} busy={busy === "new"} /> : null}
        {message ? <p role="status" className="mt-4 text-sm font-medium text-[#66816d]">{message}</p> : null}
      </div>
    </section>
  );
}

function AccountForm({ onSubmit, busy }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit} className="mt-5 grid gap-3 rounded-2xl bg-zinc-50 p-4 md:grid-cols-[1fr_180px_1fr_auto]"><Field label="Naziv" name="name" /><Field label="Iznos (€)" name="amount" type="number" inputMode="decimal" min="0" step="0.01" /><Field label="Napomena" name="note" required={false} /><button disabled={busy} className="h-12 self-end rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50">Sačuvaj</button></form>;
}

function Field({ label, required = true, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="text-sm font-semibold text-zinc-700">{label}<input {...props} required={required} className="mt-2 h-12 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-[16px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:text-sm" /></label>;
}
