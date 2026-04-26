import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "grAIder – AI-Powered Test Grading",
  description: "The AI grading assistant for teachers — build tests, collect submissions, and get instant AI-graded results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className={`${inter.variable} font-sans antialiased h-full bg-[#f5f3ff] text-indigo-950`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
