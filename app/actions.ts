"use server";

import { prisma } from "@/lib/prisma";
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
