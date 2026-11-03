import type { Metadata } from "next";
import Link from "next/link";
import { AccountNav } from "./account-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brightside Salons: book online",
  description: "Fictional salon booking app (open-source demo)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link className="brand" href="/">Brightside Salons</Link>
          <nav>
            <Link href="/book">Book</Link>
            <Link href="/bookings">My bookings</Link>
            <AccountNav />
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
