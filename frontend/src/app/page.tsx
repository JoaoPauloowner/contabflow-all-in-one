"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken, getStoredUser } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();

    if (!token || !user) {
      router.replace("/login");
    } else if (user.role === "CLIENTE") {
      router.replace("/portal-cliente");
    } else {
      router.replace("/portal-contador");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">Carregando ecossistema ContabFlow...</p>
      </div>
    </div>
  );
}
