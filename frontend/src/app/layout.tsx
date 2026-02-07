import type { Metadata } from "next";
import "./globals.css";
import { NearProvider } from "@/contexts/NearContext";

export const metadata: Metadata = {
  title: "Sentinel",
  description: "Dead Man's Switch on NEAR Protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="font-sans antialiased bg-[#0A0A0B] text-white min-h-screen"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        <NearProvider>
          {children}
        </NearProvider>
      </body>
    </html>
  );
}
