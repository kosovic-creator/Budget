"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirmation } from "@/components/confirmation-dialog";
import { addBankDeduction, deleteBankAccount, deleteBankDeduction, saveBankAccount, transferBankCashToOtp } from "@/app/actions";
import type { BankAccount } from "@/lib/bank";

interface BankAccountsProps {
  accounts: BankAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  onOtpTransfer: (otp: number) => void;
}

function money(value: number) {
  return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const installmentSuffix = /(?:^|\n)\[broj-rata:(\d+)\]$/;

export default function BankAccounts({ accounts, setAccounts, onOtpTransfer }: BankAccountsProps) {
  const { confirmRemoval, confirmation } = useConfirmation();
  const [adding, setAdding] = useState(false);
  const [deductionFormAccountId, setDeductionFormAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [transferAccountId, setTransferAccountId] = useState<string | null>(null);
  const [amountRevision, setAmountRevision] = useState(0);
  const [loanAmounts, setLoanAmounts] = useState<Record<string, string>>({});
  const total = accounts.reduce((sum, account) => sum + account.amount - account.deductions.reduce((deductions, item) => deductions + item.amount, 0), 0);

  async function saveAccount(event: React.FormEvent<HTMLFormElement>, account?: BankAccount) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(account?.id ?? "new"); setMessage("");
    const installments = form.get("installments");
    let note = account?.note ?? "";
    if (installments !== null) {
      note = note.replace(installmentSuffix, "");
      if (installments) note = [note, `[broj-rata:${installments}]`].filter(Boolean).join("\n");
    }
    const result = await saveBankAccount({ id: account?.id, name: String(form.get("name") ?? ""), amount: Number(form.get("amount")), note });
    if (result.success) {
      setAccounts((current) => account ? current.map((item) => item.id === account.id ? { ...result.account, deductions: account.deductions } : item) : [...current, result.account]);
      setAdding(false); setMessage("Sačuvano.");
    } else setMessage(result.message);
    setBusy(null);
  }

  async function transferToOtp(event: React.FormEvent<HTMLFormElement>, account: BankAccount) {
    event.preventDefault();
    if (busy) return;
    const amount = Number(new FormData(event.currentTarget).get("transferAmount"));
    setBusy(account.id);
    setMessage("");
    try {
      const result = await transferBankCashToOtp(account.id, amount);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, amount: result.amount } : item));
      onOtpTransfer(result.otp);
      setAmountRevision((revision) => revision + 1);
      setTransferAccountId(null);
      setMessage(`Preneseno na OTP karticu: ${money(amount)} €.`);
    } catch {
      setMessage("Prenos nije potvrđen. Osvježite stranicu prije novog pokušaja.");
    } finally {
      setBusy(null);
    }
  }

  async function removeAccount(account: BankAccount) {
    if (!(await confirmRemoval(`Ukloniti „${account.name}“ i sve njegove odbitke?`))) return;
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
      setDeductionFormAccountId(null);
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
      {confirmation}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(24,24,27,0.035)] md:p-6">
        <div>
          <div><h2 className="text-xl font-bold tracking-tight text-zinc-900">Banka</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Računi i planirani odbici.</p></div>
        </div>

        <div className="mt-5 space-y-4">
          {accounts.length === 0 ? <p className="rounded-xl bg-[#f5f6f7] p-5 text-sm text-[#85888d]">Još nema bankovnih stavki.</p> : accounts.map((account, index) => {
            const isOtpMain = /^otp\s+glavni\b/i.test(account.name.trim());
            const isLoan = /\bkredit\b/i.test(account.name);
            if (isLoan || (index > 0 && !isOtpMain)) {
              return (
                <form key={account.id} onSubmit={(event) => saveAccount(event, account)} className="grid grid-cols-[minmax(58px,1fr)_82px_42px_42px] items-end gap-1.5 rounded-2xl border border-zinc-200/80 p-3 sm:grid-cols-[minmax(0,1fr)_150px_44px_44px] sm:gap-2 sm:p-4">
                  <Field label="Naziv" name="name" defaultValue={account.name} />
                  <Field label="Iznos (€)" name="amount" type="number" min="0" step="0.01" defaultValue={account.amount}
                    onChange={isLoan ? (event) => {
                      const value = event.target.value;
                      setLoanAmounts((current) => ({ ...current, [account.id]: value }));
                    } : undefined} />
                  <SaveButton disabled={busy === account.id} label={`Sačuvaj ${account.name}`} />
                  <button type="button" onClick={() => removeAccount(account)} disabled={busy === account.id} aria-label={`Ukloni ${account.name}`} className="grid h-11 w-10 place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 sm:h-12 sm:w-11"><Trash2 size={17} /></button>
                  {isLoan && <LoanInstallments account={account} amount={Number(loanAmounts[account.id] ?? account.amount)} />}
                </form>
              );
            }
            const deductions = account.deductions.reduce((sum, item) => sum + item.amount, 0);
            return (
              <article key={account.id} className="rounded-2xl border border-zinc-200/80 p-4 shadow-[0_2px_10px_rgba(24,24,27,0.025)]">
                <form onSubmit={(event) => saveAccount(event, account)} className="grid grid-cols-[minmax(58px,1fr)_82px_42px_42px] items-end gap-1.5 sm:grid-cols-[minmax(0,1fr)_150px_44px_44px] sm:gap-2">
                  <Field label="Naziv" name="name" defaultValue={account.name} />
                  <Field key={isOtpMain ? amountRevision : undefined} label="Iznos (€)" name="amount" type="number" min="0" step="0.01" defaultValue={account.amount} />
                  <SaveButton disabled={busy === account.id} label={`Sačuvaj ${account.name}`} />
                  <button type="button" onClick={() => removeAccount(account)} disabled={busy === account.id} aria-label={`Ukloni ${account.name}`} className="grid h-11 w-10 place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 sm:h-12 sm:w-11"><Trash2 size={17} /></button>
                </form>

                {isOtpMain && (
                  <div className="mt-3">
                    <button type="button" aria-expanded={transferAccountId === account.id} disabled={busy !== null}
                      onClick={() => setTransferAccountId((current) => current === account.id ? null : account.id)}
                      className="min-h-11 rounded-xl border border-zinc-200 px-3 text-sm font-bold">Prebaci na OTP karticu</button>
                    {transferAccountId === account.id && (
                      <form onSubmit={(event) => transferToOtp(event, account)} className="mt-2 flex items-end gap-2">
                        <Field label="Iznos prenosa (€)" name="transferAmount" type="number" inputMode="decimal" min="0.01" max={account.amount} step="0.01" disabled={busy !== null} />
                        <button type="submit" disabled={busy !== null} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">
                          {busy === account.id ? "Čuvanje…" : "Prenesi"}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="mt-4 border-t border-[#eceeef] pt-4">
                  <p className="text-sm font-bold">Planirani odbici</p>
                  {account.deductions.map((deduction) => (
                    <div key={deduction.id} className="mt-2 flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{deduction.description}</span><strong className="shrink-0 text-sm">{money(deduction.amount)} €</strong>
                      <button type="button" onClick={() => removeDeduction(account.id, deduction.id)} disabled={busy === deduction.id} aria-label={`Ukloni odbitak ${deduction.description}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {deductionFormAccountId === account.id ? (
                    <form onSubmit={(event) => addDeduction(event, account)} className="mt-3 grid grid-cols-[minmax(0,1fr)_90px] items-end gap-2 rounded-xl bg-zinc-50 p-3 min-[430px]:grid-cols-[1fr_140px_auto]">
                      <Field label="Opis odbitka" name="description" autoFocus />
                      <Field label="Iznos (€)" name="deductionAmount" type="number" inputMode="decimal" min="0.01" step="0.01" />
                      <div className="col-span-2 flex gap-2 min-[430px]:col-span-1">
                        <button disabled={busy === `deduction-${account.id}`} aria-label="Sačuvaj odbitak" title="Sačuvaj" className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-900 text-white transition active:scale-[0.98] disabled:opacity-50 min-[430px]:h-12 min-[430px]:w-12"><Save size={17} /></button>
                        <button type="button" onClick={() => setDeductionFormAccountId(null)} className="h-11 rounded-xl border border-zinc-200 px-3 text-xs font-bold text-zinc-700 min-[430px]:h-12">Otkaži</button>
                      </div>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setDeductionFormAccountId(account.id)} className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm font-bold text-zinc-800 transition active:scale-[0.98]"><Plus size={16} /> Dodaj odbitak</button>
                  )}
                   <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="text-sm font-semibold text-emerald-950">{account.name} nakon odbitaka</span><strong className="text-emerald-950">{money(account.amount - deductions)} €</strong></div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-4 text-white shadow-lg shadow-zinc-900/10"><span className="font-semibold">Ukupno</span><strong className="text-xl">{money(total)} €</strong></div>
        <button type="button" onClick={() => setAdding((value) => !value)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm font-bold text-zinc-800 transition active:scale-[0.98] min-[390px]:w-auto"><Plus size={16} /> {adding ? "Otkaži" : "Dodaj stavku"}</button>
        {adding ? <AccountForm onSubmit={(event) => saveAccount(event)} busy={busy === "new"} /> : null}
        {message ? <p role="status" className="mt-4 text-sm font-medium text-[#66816d]">{message}</p> : null}
      </div>
    </section>
  );
}

function LoanInstallments({ account, amount }: { account: BankAccount; amount: number }) {
  const [count, setCount] = useState(account.note.match(installmentSuffix)?.[1] ?? "");
  const installment = Number.isInteger(Number(count)) && Number(count) > 0 && Number.isFinite(amount) && amount >= 0
    ? amount / Number(count) : null;
  return (
    <fieldset className="col-span-full mt-2 grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 p-3">
      <legend className="px-1 text-sm font-bold">Iznos rate</legend>
      <Field label="Broj rata" name="installments" type="number" min="1" max="10000" step="1"
        required={false} value={count} onChange={(event) => setCount(event.target.value)} />
      <label className="min-w-0 text-[11px] font-semibold text-zinc-700 sm:text-sm">
        Iznos po rati (€)
        <output className="mt-2 flex min-h-11 items-center rounded-xl bg-zinc-50 px-2 text-base font-bold sm:min-h-12">
          {installment === null ? "—" : `${money(installment)} €`}
        </output>
      </label>
    </fieldset>
  );
}

function AccountForm({ onSubmit, busy }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit} className="mt-5 grid grid-cols-[minmax(0,1fr)_82px_42px] items-end gap-1.5 rounded-2xl bg-zinc-50 p-3 sm:grid-cols-[minmax(0,1fr)_150px_44px] sm:gap-2 sm:p-4"><Field label="Naziv" name="name" /><Field label="Iznos (€)" name="amount" type="number" inputMode="decimal" min="0" step="0.01" /><SaveButton disabled={busy} label="Sačuvaj novu bankovnu stavku" primary /></form>;
}

function Field({ label, required = true, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="min-w-0 overflow-hidden text-[11px] font-semibold text-zinc-700 sm:text-sm">{label}<input {...props} required={required} className="mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2 text-[16px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:h-12 sm:px-3 sm:text-sm" /></label>;
}

function SaveButton({ disabled, label, primary = false }: { disabled: boolean; label: string; primary?: boolean }) {
  return <button disabled={disabled} aria-label={label} title="Sačuvaj" className={`grid h-11 w-10 place-items-center rounded-xl transition active:scale-[0.98] disabled:opacity-50 sm:h-12 sm:w-11 ${primary ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-700"}`}><Save size={17} /></button>;
}
