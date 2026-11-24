"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  CreateTransactionResult,
  DatabaseTransactionCategory,
  NewTransaction,
  TransactionCategory,
} from "@/lib/transactions";
import { serializeTransaction } from "@/lib/transactions";
import type { PlannedExpenseCategory, PlannedItemKind } from "@/lib/planned-items";
import type { RecurringItemKind } from "@/lib/recurring-items";
import { getBudgetCycle } from "@/lib/billing-cycle";

const categoryMap = {
  "Kućni troškovi": "HOUSEHOLD",
  "Lični troškovi": "PERSONAL",
  "Redovni troškovi": "REGULAR",
  Plata: "SALARY",
  Ostalo: "OTHER",
} satisfies Record<TransactionCategory, DatabaseTransactionCategory>;

export async function createTransaction(
  input: NewTransaction,
): Promise<CreateTransactionResult> {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false, message: "Sesija je istekla. Prijavite se ponovo." };
  }

  if (!input || typeof input.title !== "string") {
    return {
      success: false,
      message: "Provjerite naziv, kategoriju i iznos transakcije.",
    };
  }

  const title = input.title.trim() || (input.type === "income" ? "Priliv" : input.category);
  const validCategory =
    Object.prototype.hasOwnProperty.call(categoryMap, input.category);
  const validType = input.type === "income" || input.type === "expense";

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    input.amount > 9_999_999_999.99 ||
    !validCategory ||
    !validType
  ) {
    return {
      success: false,
      message: "Provjerite naziv, kategoriju i iznos transakcije.",
    };
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        title,
        amount: input.amount.toFixed(2),
        type: input.type === "income" ? "INCOME" : "EXPENSE",
        category: categoryMap[input.category],
      },
    });

    return { success: true, transaction: serializeTransaction(transaction) };
  } catch (error) {
    console.error("Neuspješno čuvanje transakcije u Neon bazi.", error);
    return {
      success: false,
      message: "Transakcija nije sačuvana. Provjerite bazu i pokušajte ponovo.",
    };
  }
}

export async function deleteTransaction(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
  }

  if (typeof id !== "string" || !id.trim()) {
    return { success: false as const, message: "Transakcija nije pronađena." };
  }

  try {
    await prisma.transaction.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Neuspješno uklanjanje transakcije.", error);
    return { success: false as const, message: "Transakcija nije uklonjena. Pokušajte ponovo." };
  }
}

export async function createPlannedItem(input: { description: string; amount: number; kind: PlannedItemKind; expenseCategory: PlannedExpenseCategory | null }) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
  }

  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const expenseCategory = input.expenseCategory === "household" || input.expenseCategory === "personal" ? input.expenseCategory : null;
  if (!description || description.length > 120 || !Number.isFinite(input?.amount) || input.amount <= 0 || input.amount > 9_999_999_999.99 || (input.kind !== "addition" && input.kind !== "expectedExpense") || (input.kind === "expectedExpense" && !expenseCategory)) {
    return { success: false as const, message: "Unesite opis i ispravan iznos." };
  }

  try {
    const { item, limits } = await prisma.$transaction(async (tx) => {
      const settings = await tx.budgetSettings.findUnique({ where: { id: "default" } });
      if (input.kind === "expectedExpense" && (!settings || Number(expenseCategory === "household" ? settings.household : settings.personal) < input.amount)) {
        throw new Error("LIMIT_TOO_LOW");
      }
      const item = await tx.plannedItem.create({ data: { description, amount: input.amount.toFixed(2), kind: input.kind === "addition" ? "ADDITION" : "EXPECTED_EXPENSE", expenseCategory: input.kind === "expectedExpense" ? (expenseCategory === "household" ? "HOUSEHOLD" : "PERSONAL") : null } });
      const updated = input.kind === "expectedExpense"
        ? await tx.budgetSettings.update({ where: { id: "default" }, data: expenseCategory === "household" ? { household: { decrement: input.amount } } : { personal: { decrement: input.amount } } })
        : settings;
      return { item, limits: updated ? { household: Number(updated.household), personal: Number(updated.personal) } : null };
    });
    return {
      success: true as const,
      item: { id: item.id, description: item.description, amount: Number(item.amount), kind: input.kind, expenseCategory },
      limits,
    };
  } catch (error) {
    console.error("Neuspješno čuvanje planirane stavke.", error);
    if (error instanceof Error && error.message === "LIMIT_TOO_LOW") return { success: false as const, message: "Očekivani trošak je veći od izabranog mjesečnog limita." };
    return { success: false as const, message: "Stavka nije sačuvana. Pokušajte ponovo." };
  }
}

export async function updatePlannedItem(input: { id: string; description: string; amount: number; expenseCategory: PlannedExpenseCategory | null }) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
  }

  const id = typeof input?.id === "string" ? input.id.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const expenseCategory = input.expenseCategory === "household" || input.expenseCategory === "personal" ? input.expenseCategory : null;
  if (!id || !description || description.length > 120 || !Number.isFinite(input?.amount) || input.amount <= 0 || input.amount > 9_999_999_999.99) {
    return { success: false as const, message: "Unesite opis i ispravan iznos." };
  }

  try {
    const existing = await prisma.plannedItem.findUnique({ where: { id } });
    if (!existing || (existing.kind === "EXPECTED_EXPENSE" && !expenseCategory)) {
      return { success: false as const, message: "Izaberite kućne ili lične troškove." };
    }
    const { item, limits } = await prisma.$transaction(async (tx) => {
      let settings = await tx.budgetSettings.findUnique({ where: { id: "default" } });
      if (existing.kind === "EXPECTED_EXPENSE" && settings) {
        if (existing.expenseCategory === "HOUSEHOLD") settings = await tx.budgetSettings.update({ where: { id: "default" }, data: { household: { increment: Number(existing.amount) } } });
        if (existing.expenseCategory === "PERSONAL") settings = await tx.budgetSettings.update({ where: { id: "default" }, data: { personal: { increment: Number(existing.amount) } } });
        if (Number(expenseCategory === "household" ? settings.household : settings.personal) < input.amount) throw new Error("LIMIT_TOO_LOW");
        settings = await tx.budgetSettings.update({ where: { id: "default" }, data: expenseCategory === "household" ? { household: { decrement: input.amount } } : { personal: { decrement: input.amount } } });
      }
      const item = await tx.plannedItem.update({ where: { id }, data: { description, amount: input.amount.toFixed(2), expenseCategory: existing.kind === "EXPECTED_EXPENSE" ? (expenseCategory === "household" ? "HOUSEHOLD" : "PERSONAL") : null } });
      return { item, limits: settings ? { household: Number(settings.household), personal: Number(settings.personal) } : null };
    });
    return {
      success: true as const,
      item: {
        id: item.id,
        description: item.description,
        amount: Number(item.amount),
        kind: item.kind === "ADDITION" ? "addition" as const : "expectedExpense" as const,
        expenseCategory: item.expenseCategory === "HOUSEHOLD" ? "household" as const : item.expenseCategory === "PERSONAL" ? "personal" as const : null,
      },
      limits,
    };
  } catch (error) {
    console.error("Neuspješno mijenjanje planirane stavke.", error);
    if (error instanceof Error && error.message === "LIMIT_TOO_LOW") return { success: false as const, message: "Očekivani trošak je veći od izabranog mjesečnog limita." };
    return { success: false as const, message: "Izmjena nije sačuvana. Pokušajte ponovo." };
  }
}

export async function deletePlannedItem(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
  }
  if (typeof id !== "string" || !id.trim()) {
    return { success: false as const, message: "Stavka nije pronađena." };
  }
  try {
    const { limits } = await prisma.$transaction(async (tx) => {
      const item = await tx.plannedItem.findUnique({ where: { id } });
      if (!item) throw new Error("NOT_FOUND");
      let settings = await tx.budgetSettings.findUnique({ where: { id: "default" } });
      if (item.kind === "EXPECTED_EXPENSE" && item.expenseCategory === "HOUSEHOLD") settings = await tx.budgetSettings.update({ where: { id: "default" }, data: { household: { increment: Number(item.amount) } } });
      if (item.kind === "EXPECTED_EXPENSE" && item.expenseCategory === "PERSONAL") settings = await tx.budgetSettings.update({ where: { id: "default" }, data: { personal: { increment: Number(item.amount) } } });
      await tx.plannedItem.delete({ where: { id } });
      return { limits: settings ? { household: Number(settings.household), personal: Number(settings.personal) } : null };
    });
    return { success: true as const, limits };
  } catch (error) {
    console.error("Neuspješno uklanjanje planirane stavke.", error);
    return { success: false as const, message: "Stavka nije uklonjena." };
  }
}

export async function saveRecurringItem(input: { id?: string; name: string; amount: number; kind: RecurringItemKind }) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
  }
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100 || !Number.isFinite(input?.amount) || input.amount <= 0 || input.amount > 9_999_999_999.99 || (input.kind !== "fixed" && input.kind !== "subscription")) {
    return { success: false as const, message: "Unesite naziv i ispravan iznos." };
  }
  const data = { name, amount: input.amount.toFixed(2), kind: input.kind === "fixed" ? "FIXED" as const : "SUBSCRIPTION" as const };
  try {
    const item = input.id
      ? await prisma.recurringItem.update({ where: { id: input.id }, data })
      : await prisma.recurringItem.create({ data });
    return { success: true as const, item: { id: item.id, name: item.name, amount: Number(item.amount), kind: input.kind, paid: item.paidCycle === getBudgetCycle() } };
  } catch (error) {
    console.error("Neuspješno čuvanje mjesečne stavke.", error);
    return { success: false as const, message: "Stavka nije sačuvana." };
  }
}

export async function deleteRecurringItem(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) return { success: false as const, message: "Sesija je istekla." };
  try {
    await prisma.recurringItem.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Neuspješno uklanjanje mjesečne stavke.", error);
    return { success: false as const, message: "Stavka nije uklonjena." };
  }
}

export async function payRecurringItem(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) return { success: false as const, message: "Sesija je istekla." };
  try {
    const item = await prisma.recurringItem.findUnique({ where: { id } });
    if (!item) return { success: false as const, message: "Mjesečna stavka nije pronađena." };
    const currentCycle = getBudgetCycle();
    if (item.paidCycle === currentCycle) return { success: false as const, message: "Ovaj trošak je već plaćen u tekućem periodu." };
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({ data: { id: recurringPaymentId(id, currentCycle), title: item.name, amount: item.amount, type: "EXPENSE", category: "REGULAR" } }),
      prisma.recurringItem.update({ where: { id }, data: { paid: true, paidCycle: currentCycle } }),
    ]);
    return { success: true as const, itemId: item.id, transaction: serializeTransaction(transaction) };
  } catch (error) {
    console.error("Neuspješno evidentiranje plaćanja.", error);
    return { success: false as const, message: "Plaćanje nije evidentirano." };
  }
}

function recurringPaymentId(id: string, cycle: string) {
  return `recurring-payment:${id}:${cycle}`;
}

export async function resetRecurringPayment(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla." };
  }
  const cycle = getBudgetCycle();
  const transactionId = recurringPaymentId(id, cycle);
  try {
    const removed = await prisma.$transaction(async (tx) => {
      await tx.recurringItem.update({
        where: { id, kind: "FIXED", paidCycle: cycle },
        data: { paid: false, paidCycle: null },
      });
      return tx.transaction.deleteMany({ where: { id: transactionId } });
    });
    return { success: true as const, transactionId, removedTransaction: removed.count > 0 };
  } catch (error) {
    console.error("Neuspješno poništavanje plaćanja.", error);
    return { success: false as const, message: "Plaćanje nije poništeno. Osvježite stranicu i pokušajte ponovo." };
  }
}

export async function saveBankAccount(input: { id?: string; name: string; amount: number; note: string }) {
  if (!(await auth.api.getSession({ headers: await headers() }))) return { success: false as const, message: "Sesija je istekla." };
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const note = typeof input?.note === "string" ? input.note.trim() : "";
  if (!name || name.length > 100 || note.length > 200 || !Number.isFinite(input?.amount) || input.amount < 0 || input.amount > 9_999_999_999.99) {
    return { success: false as const, message: "Unesite naziv i ispravan iznos." };
  }
  try {
    const data = { name, amount: input.amount.toFixed(2), note };
    const item = input.id ? await prisma.bankAccount.update({ where: { id: input.id }, data }) : await prisma.bankAccount.create({ data });
    return { success: true as const, account: { id: item.id, name: item.name, amount: Number(item.amount), note: item.note, deductions: [] } };
  } catch (error) {
    console.error("Neuspješno čuvanje bankovnog računa.", error);
    return { success: false as const, message: "Bankovni račun nije sačuvan." };
  }
}

export async function deleteBankAccount(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) return { success: false as const, message: "Sesija je istekla." };
  try {
    await prisma.bankAccount.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Neuspješno uklanjanje bankovnog računa.", error);
    return { success: false as const, message: "Račun nije uklonjen." };
  }
}

export async function addBankDeduction(input: { accountId: string; description: string; amount: number }) {
  if (!(await auth.api.getSession({ headers: await headers() }))) return { success: false as const, message: "Sesija je istekla." };
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (!input.accountId || !description || description.length > 120 || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 9_999_999_999.99) {
    return { success: false as const, message: "Unesite opis i ispravan iznos odbitka." };
  }
  try {
    const item = await prisma.bankDeduction.create({ data: { accountId: input.accountId, description, amount: input.amount.toFixed(2) } });
    return { success: true as const, deduction: { id: item.id, description: item.description, amount: Number(item.amount) } };
  } catch (error) {
    console.error("Neuspješno čuvanje bankovnog odbitka.", error);
    return { success: false as const, message: "Odbitak nije sačuvan." };
  }
}

export async function deleteBankDeduction(id: string) {
  if (!(await auth.api.getSession({ headers: await headers() }))) return { success: false as const, message: "Sesija je istekla." };
  try {
    await prisma.bankDeduction.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Neuspješno uklanjanje bankovnog odbitka.", error);
    return { success: false as const, message: "Odbitak nije uklonjen." };
  }
}

export async function saveBudget(input: import("@/lib/budget").BudgetSettings) {
 if (!(await auth.api.getSession({ headers: await headers() }))) {
  return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
 }
 const keys = ["household", "personal", "other", "cash", "otp", "nlb", "additions", "expectedExpenses"] as const;
 if (!input || keys.some(key => typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] < 0 || input[key] > 9_999_999_999.99)) return { success: false as const, message: "Unesite ispravne nenegativne iznose." };
 const data = {
  household: input.household.toFixed(2),
  personal: input.personal.toFixed(2),
  other: input.other.toFixed(2),
  cash: input.cash.toFixed(2),
  otp: input.otp.toFixed(2),
  nlb: input.nlb.toFixed(2),
  additions: input.additions.toFixed(2),
  expectedExpenses: input.expectedExpenses.toFixed(2),
 };
 try {
 await prisma.budgetSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
 return { success: true as const };
 } catch (error) {
 console.error("Neuspješno čuvanje plana i keša.", error);
 return { success: false as const, message: "Podaci nijesu sačuvani. Pokušajte ponovo." };
 }
}
