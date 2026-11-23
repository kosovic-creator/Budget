import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanse | Pregled budžeta",
  description: "Pregled priliva, odliva i planiranih troškova",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
