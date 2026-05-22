import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BBYO Depósito",
  description: "Inventario y préstamos de materiales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
