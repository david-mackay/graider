import type { Metadata } from "next";
import { Caveat, Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Graider — the AI red pen",
  description:
    "Photograph a stack of papers and Graider reads, matches, and marks every one — so the grading is done before your coffee is.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body
          className={`${fraunces.variable} ${nunito.variable} ${caveat.variable} font-sans antialiased h-full`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
