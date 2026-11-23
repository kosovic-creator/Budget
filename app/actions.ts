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

const categoryMap = {
  "Kućni troškovi": "HOUSEHOLD",
  "Lični troškovi": "PERSONAL",
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

  const title = input.title.trim();
  const validCategory =
    Object.prototype.hasOwnProperty.call(categoryMap, input.category);
  const validType = input.type === "income" || input.type === "expense";

  if (
    !title ||
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

export async function saveBudget(input: import("@/lib/budget").BudgetSettings) {
 if (!(await auth.api.getSession({ headers: await headers() }))) {
  return { success: false as const, message: "Sesija je istekla. Prijavite se ponovo." };
 }
 const keys = ["household", "personal", "other", "cash"] as const;
 if (!input || keys.some(key => typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] < 0 || input[key] > 9_999_999_999.99)) return { success: false as const, message: "Unesite ispravne nenegativne iznose." };
 const data = { household: input.household.toFixed(2), personal: input.personal.toFixed(2), other: input.other.toFixed(2), cash: input.cash.toFixed(2) };
 try {
 await prisma.budgetSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
 return { success: true as const };
 } catch (error) {
 console.error("Neuspješno čuvanje plana i keša.", error);
 return { success: false as const, message: "Podaci nijesu sačuvani. Pokušajte ponovo." };
 }
}
