import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nigeria Election Monitor", description: "Live results and monitoring for Nigerian elections." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
