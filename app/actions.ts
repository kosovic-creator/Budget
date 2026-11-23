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
import type { PlannedItemKind } from "@/lib/planned-items";
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

export async function createPlannedItem(input: { description: string; amount: number; kind: PlannedItemKind }) {
  if (!(await auth.api.getSession({ headers: await headers() }))) {
    return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
  }

  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (!description || description.length > 120 || !Number.isFinite(input?.amount) || input.amount <= 0 || input.amount > 9_999_999_999.99 || (input.kind !== "addition" && input.kind !== "expectedExpense")) {
    return { success: false as const, message: "Unesite opis i ispravan iznos." };
  }

  try {
    const item = await prisma.plannedItem.create({
      data: {
        description,
        amount: input.amount.toFixed(2),
        kind: input.kind === "addition" ? "ADDITION" : "EXPECTED_EXPENSE",
      },
    });
    return {
      success: true as const,
      item: { id: item.id, description: item.description, amount: Number(item.amount), kind: input.kind },
    };
  } catch (error) {
    console.error("Neuspješno čuvanje planirane stavke.", error);
    return { success: false as const, message: "Stavka nije sačuvana. Pokušajte ponovo." };
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
    await prisma.plannedItem.delete({ where: { id } });
    return { success: true as const };
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
    if (!item || item.kind !== "FIXED") return { success: false as const, message: "Fiksni trošak nije pronađen." };
    const currentCycle = getBudgetCycle();
    if (item.paidCycle === currentCycle) return { success: false as const, message: "Ovaj trošak je već plaćen u tekućem periodu." };
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({ data: { title: item.name, amount: item.amount, type: "EXPENSE", category: "REGULAR" } }),
      prisma.recurringItem.update({ where: { id }, data: { paid: true, paidCycle: currentCycle } }),
    ]);
    return { success: true as const, itemId: item.id, transaction: serializeTransaction(transaction) };
  } catch (error) {
    console.error("Neuspješno evidentiranje plaćanja.", error);
    return { success: false as const, message: "Plaćanje nije evidentirano." };
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
