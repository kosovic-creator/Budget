import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget — test",
  description: "Pregled priliva, odliva i planiranih troškova",
  applicationName: "Moj budžet",
  appleWebApp: {
    capable: true,
    title: "Moj budžet",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7f8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
