"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSession, UserSession } from "@/lib/api";
import { Building2, ShieldCheck, ArrowRight, Lock, Mail, User, Phone, FileText, Sparkles, CheckCircle2 } from "lucide-react";

export default function CadastroPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nome_escritorio: "",
    cnpj: "",
    email_escritorio: "",
    telefone: "",
    admin_nome: "",
    admin_email: "",
    admin_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/register-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        let msgErro = "Erro ao registrar escritório. Verifique os dados.";
        if (typeof data.detail === "string") {
          msgErro = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          const primeiro = data.detail[0];
          const campo = primeiro.loc ? primeiro.loc[primeiro.loc.length - 1] : "campo";
          if (primeiro.msg && primeiro.msg.includes("valid email")) {
            msgErro = `O e-mail "${primeiro.input || ""}" é inválido. Por favor, digite um e-mail completo (ex: seu.nome@empresa.com.br).`;
          } else if (primeiro.msg && primeiro.msg.includes("at least")) {
            msgErro = `O campo "${campo}" deve ter mais caracteres.`;
          } else {
            msgErro = `Aviso no campo "${campo}": ${primeiro.msg}`;
          }
        }
        throw new Error(msgErro);
      }

      setSucesso(true);

      const session: UserSession = {
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        cliente_id: data.cliente_id,
        role: data.role,
        nome: data.nome,
        email: data.email,
      };

      saveSession(data.access_token, session);

      setTimeout(() => {
        router.push("/portal-contador");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Falha na conexão com o servidor.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Luz ambiente de fundo (Glow) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-xl z-10">
        {/* Cabeçalho de Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-500/20 mb-4 border border-emerald-400/30">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Cadastrar <span className="text-emerald-400">Escritório Contábil</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Inicie seu ambiente corporativo isolado (Zero-Data) e gere seu Tenant ID oficial
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {sucesso && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Escritório registrado com sucesso! Inicializando o Cockpit 360°...</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Building2 className="w-3.5 h-3.5" /> 1. Dados da Organização (Escritório)
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome / Razão Social do Escritório
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    name="nome_escritorio"
                    value={formData.nome_escritorio}
                    onChange={handleChange}
                    placeholder="Ex: Confiança Assessoria Contábil Ltda"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    CNPJ do Escritório
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      name="cnpj"
                      value={formData.cnpj}
                      onChange={handleChange}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    WhatsApp de Atendimento
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleChange}
                      placeholder="(11) 99999-8888"
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  E-mail Corporativo do Escritório
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    name="email_escritorio"
                    value={formData.email_escritorio}
                    onChange={handleChange}
                    placeholder="contato@escritorio.com.br"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <User className="w-3.5 h-3.5" /> 2. Primeiro Administrador / Contador Titular
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome Completo do Contador
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    name="admin_nome"
                    value={formData.admin_nome}
                    onChange={handleChange}
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    E-mail de Login
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      name="admin_email"
                      value={formData.admin_email}
                      onChange={handleChange}
                      placeholder="carlos@escritorio.com.br"
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Senha Mestre
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      name="admin_password"
                      value={formData.admin_password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs transition outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || sucesso}
              className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Criando Escritório...</span>
              ) : (
                <>
                  <span>Criar Meu Escritório & Inicializar Tenant</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-emerald-400 transition"
            >
              Já possui um escritório cadastrado? <span className="font-semibold text-emerald-400 underline">Fazer Login</span>
            </Link>
          </div>
        </div>

        {/* Rodapé de Segurança */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Isolamento Multi-Tenant Garantido por Tenant ID</span>
        </div>
      </div>
    </div>
  );
}
