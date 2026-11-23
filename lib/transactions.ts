export type TransactionCategory =
  | "Kućni troškovi"
  | "Lični troškovi"
  | "Redovni troškovi"
  | "Plata"
  | "Ostalo";

export type TransactionType = "income" | "expense";
export type DatabaseTransactionCategory =
  | "PERSONAL"
  | "HOUSEHOLD"
  | "REGULAR"
  | "SALARY"
  | "OTHER";
export type DatabaseTransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  id: string;
  title: string;
  category: TransactionCategory;
  date: string;
  amount: number;
  type: TransactionType;
}

export interface DatabaseTransaction {
  id: string;
  title: string;
  category: DatabaseTransactionCategory;
  date: Date;
  amount: { toString(): string };
  type: DatabaseTransactionType;
}

export interface NewTransaction {
  title: string;
  category: TransactionCategory;
  amount: number;
  type: TransactionType;
}

export type CreateTransactionResult =
  | { success: true; transaction: Transaction }
  | { success: false; message: string };

const categoryLabels: Record<DatabaseTransactionCategory, TransactionCategory> = {
  HOUSEHOLD: "Kućni troškovi",
  REGULAR: "Redovni troškovi",
  PERSONAL: "Lični troškovi",
  SALARY: "Plata",
  OTHER: "Ostalo",
};

export function serializeTransaction(
  transaction: DatabaseTransaction,
): Transaction {
  return {
    id: transaction.id,
    title: transaction.title,
    category: categoryLabels[transaction.category],
    date: new Intl.DateTimeFormat("sr-RS", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(transaction.date),
    amount:
      (transaction.type === "EXPENSE" ? -1 : 1) *
      Number(transaction.amount.toString()),
    type: transaction.type === "INCOME" ? "income" : "expense",
  };
}
