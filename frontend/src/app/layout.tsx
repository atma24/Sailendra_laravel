import type { Metadata } from "next";
import "./globals.css";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Sailendra",
  description: "Sailendra WMS",
  icons: {
    icon: "/faviconlogo.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
