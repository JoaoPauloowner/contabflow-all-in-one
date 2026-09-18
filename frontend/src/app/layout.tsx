import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContabFlow All-in-One — Gestão Fiscal, WhatsApp & IA",
  description: "Plataforma unificada para escritórios contábeis e seus clientes: rotinas fiscais, guias com PIX, Helpdesk e Copiloto de IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
        {children}
      </body>
    </html>
  );
}
