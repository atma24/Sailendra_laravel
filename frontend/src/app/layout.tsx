import type { Metadata } from "next";
import "./globals.css";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { ToastProvider } from "@/components/ToastProvider";
import { SessionMonitor } from "@/components/SessionMonitor";
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Sailendra",
  description: "Sailendra WMS",
  icons: {
    icon: "/faviconlogo.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`h-full antialiased ${plusJakarta.className}`}>
      <body className="min-h-full">
        <ToastProvider>
          <SessionMonitor />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
