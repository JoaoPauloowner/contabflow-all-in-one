"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSession, UserSession } from "@/lib/api";
import { ShieldCheck, ArrowRight, Lock, Mail, Sparkles, Building2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "E-mail ou senha incorretos.");
      }

      const session: UserSession = {
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        cliente_id: data.cliente_id,
        role: data.role,
        nome: data.nome,
        email: data.email,
      };

      saveSession(data.access_token, session);

      if (session.role === "CLIENTE") {
        router.push("/portal-cliente");
      } else {
        router.push("/portal-contador");
      }
    } catch (err: any) {
      setError(err.message || "Falha na autenticação. Verifique se o escritório foi cadastrado.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Luz ambiente de fundo (Glow) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Cabeçalho de Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-500/20 mb-4 border border-emerald-400/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Contab<span className="text-emerald-400">Flow</span>
            <span className="text-xs uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono font-semibold">
              All-in-One
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Acesso Corporativo do Escritório e Empresas Clientes
          </p>
        </div>

        {/* Card do Formulário Limpo (Zero-Data) */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                E-mail de Login
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@escritorio.com.br"
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm transition outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm transition outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Verificando credenciais...</span>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Link para Criar Novo Escritório */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center space-y-3">
            <p className="text-xs text-slate-400">
              Primeira vez acessando?
            </p>
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-700/60 text-xs font-semibold transition"
            >
              <Building2 className="w-4 h-4" />
              <span>Cadastrar Novo Escritório Contábil</span>
            </Link>
          </div>
        </div>

        {/* Rodapé de Segurança */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Isolamento Multi-Tenant Garantido por JWT</span>
        </div>
      </div>
    </div>
  );
}
