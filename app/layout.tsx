import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Options Flow Analyzer",
  description: "Advanced Option Chain Analysis and Ratio Calculator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
