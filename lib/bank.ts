export interface BankDeduction {
  id: string;
  description: string;
  amount: number;
}

export interface BankAccount {
  id: string;
  name: string;
  amount: number;
  note: string;
  deductions: BankDeduction[];
}
