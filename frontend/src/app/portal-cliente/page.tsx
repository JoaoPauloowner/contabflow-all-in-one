"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearSession, UserSession, fetchWithAuth } from "@/lib/api";
import {
  Building2,
  FileText,
  Upload,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  LogOut,
  Send,
  HelpCircle,
  Download,
  AlertCircle,
  Phone,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  FileCheck,
  FileX,
  AlertTriangle,
  X,
  Plus,
  Sun,
  Moon,
} from "lucide-react";

interface ImpostoItem {
  id: string;
  cliente_id: string;
  titulo: string;
  tipo_guia: string;
  competencia: string;
  data_vencimento: string;
  valor: number;
  linha_digitavel?: string;
  codigo_pix?: string;
  status: string;
  created_at: string;
}

interface DocumentoCliente {
  id: string;
  titulo: string;
  tipo: string;
  competencia: string;
  file_name: string;
  file_size: number;
  file_extension: string;
  status: "PENDENTE" | "PROCESSADO" | "REJEITADO";
  motivo_rejeicao?: string;
  valor_total?: number;
  score_confianca?: number;
  created_at: string;
}

interface SolicitacaoCliente {
  id: string;
  assunto: string;
  descricao: string;
  departamento: string;
  prioridade: string;
  status: string;
  created_at: string;
  resposta?: string;
}

export default function PortalClientePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(true);
  const [chaveCopiadaId, setChaveCopiadaId] = useState<string | null>(null);
  const [linhaCopiadaId, setLinhaCopiadaId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [enviandoArquivos, setEnviandoArquivos] = useState(false);
  const [modalDuvidaAberta, setModalDuvidaAberta] = useState(false);
  const [novaDuvidaAssunto, setNovaDuvidaAssunto] = useState("");
  const [novaDuvidaTexto, setNovaDuvidaTexto] = useState("");
  const [salvandoDuvida, setSalvandoDuvida] = useState(false);
  const [notificacao, setNotificacao] = useState<string | null>(null);
  const [telefoneEscritorio, setTelefoneEscritorio] = useState<string>("5511999998888");

  // Dados reais sincronizados com o backend
  const [impostos, setImpostos] = useState<ImpostoItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCliente[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCliente[]>([]);

  const carregarDadosCliente = async () => {
    setLoading(true);
    try {
      // 1. Guias de impostos do cliente
      const resImpostos = await fetchWithAuth("/api/v1/impostos");
      if (resImpostos.ok) {
        const dados = await resImpostos.json();
        setImpostos(dados);
      }

      // 2. Documentos fiscais enviados pelo cliente
      const resDocs = await fetchWithAuth("/api/v1/documentos");
      if (resDocs.ok) {
        const dados = await resDocs.json();
        setDocumentos(dados);
      }

      // 3. Chamados e dúvidas do cliente
      const resChamados = await fetchWithAuth("/api/v1/solicitacoes");
      if (resChamados.ok) {
        const dados = await resChamados.json();
        setSolicitacoes(dados);
      }

      // 4. Dados de contato do escritório
      const resEscritorio = await fetchWithAuth("/api/v1/auth/escritorio");
      if (resEscritorio.ok) {
        const esc = await resEscritorio.json();
        if (esc.telefone) {
          const telLimpo = esc.telefone.replace(/\D/g, "");
          if (telLimpo) setTelefoneEscritorio(telLimpo);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados do Portal do Cliente:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Inicialização do tema
    const temaSalvo = (localStorage.getItem("contabflow_theme") as "dark" | "light") || "dark";
    setTema(temaSalvo);
    if (temaSalvo === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }

    const storedUser = getStoredUser();
    if (!storedUser) {
      router.replace("/login");
      return;
    }
    setUser(storedUser);
    carregarDadosCliente();
  }, [router]);

  const alternarTema = () => {
    const novoTema = tema === "dark" ? "light" : "dark";
    setTema(novoTema);
    localStorage.setItem("contabflow_theme", novoTema);
    if (novoTema === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  };

  const handleLogout = () => {
    clearSession();
    router.replace("/login");
  };

  const copiarPix = (id: string, pix: string) => {
    navigator.clipboard.writeText(pix);
    setChaveCopiadaId(id);
    setNotificacao("Código PIX Copia e Cola copiado com sucesso!");
    setTimeout(() => {
      setChaveCopiadaId(null);
      setNotificacao(null);
    }, 2500);
  };

  const copiarLinha = (id: string, linha: string) => {
    navigator.clipboard.writeText(linha);
    setLinhaCopiadaId(id);
    setNotificacao("Linha digitável do boleto copiada!");
    setTimeout(() => {
      setLinhaCopiadaId(null);
      setNotificacao(null);
    }, 2500);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEnviandoArquivos(true);

    try {
      let enviadosSucesso = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("titulo", file.name);

        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        let tipo = "OUTROS";
        if (ext === "xml") tipo = "NFE";
        else if (ext === "ofx") tipo = "EXTRATO";
        else if (["jpg", "jpeg", "png", "pdf"].includes(ext)) tipo = "RECIBO";

        formData.append("tipo", tipo);
        const agora = new Date();
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        formData.append("competencia", `${mes}/${agora.getFullYear()}`);

        const res = await fetchWithAuth("/api/v1/documentos/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          enviadosSucesso++;
        }
      }

      setNotificacao(
        `✅ ${enviadosSucesso} arquivo(s) enviado(s) para a contabilidade com extração OCR imediata!`
      );
      carregarDadosCliente();
    } catch (e) {
      alert("Erro ao enviar documentos. Verifique sua conexão.");
    } finally {
      setEnviandoArquivos(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const enviarNovaDuvida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaDuvidaTexto.trim()) return;

    setSalvandoDuvida(true);
    try {
      const res = await fetchWithAuth("/api/v1/solicitacoes", {
        method: "POST",
        body: JSON.stringify({
          assunto: novaDuvidaAssunto.trim() || "Dúvida Fiscal / Contábil",
          descricao: novaDuvidaTexto.trim(),
          departamento: "FISCAL",
          prioridade: "MEDIA",
          origem: "PORTAL",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro ao registrar chamado.");
      }

      setModalDuvidaAberta(false);
      setNovaDuvidaAssunto("");
      setNovaDuvidaTexto("");
      setNotificacao(
        "🚀 Chamado enviado com sucesso! O Copiloto de IA fará a triagem inicial e seu contador responderá."
      );
      carregarDadosCliente();
    } catch (err: any) {
      alert(err.message || "Erro ao registrar dúvida.");
    } finally {
      setSalvandoDuvida(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Barra de Navegação do Cliente */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 flex items-center justify-center shadow-md shadow-teal-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base">
                {user.nome || "Portal do Cliente"}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-300 font-semibold uppercase">
                Área do Cliente
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Empresa Conectada • Multi-Tenant Isolado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botão de Alternância de Tema Claro / Escuro */}
          <button
            onClick={alternarTema}
            className="p-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            title={tema === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
          >
            {tema === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-medium hidden sm:inline text-amber-300">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] font-medium hidden sm:inline text-indigo-300">Escuro</span>
              </>
            )}
          </button>

          <button
            onClick={carregarDadosCliente}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-teal-400" : ""}`} />
          </button>

          {/* Botão de Contato Direto via WhatsApp */}
          <a
            href={`https://wa.me/${telefoneEscritorio}?text=Ol%C3%A1%2C+sou+da+empresa+${encodeURIComponent(
              user.nome
            )}+e+gostaria+de+um+suporte+cont%C3%A1bil.`}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fale no WhatsApp</span>
          </a>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700/60 text-slate-400 transition cursor-pointer"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Banner de Notificação Toast */}
      {notificacao && (
        <div className="fixed top-16 right-6 z-50 max-w-md bg-slate-900 border border-teal-500/40 rounded-2xl p-4 shadow-2xl shadow-teal-500/10 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <p className="text-xs text-teal-200 font-medium leading-relaxed">{notificacao}</p>
        </div>
      )}

      {/* Conteúdo do Portal do Cliente */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Banner de Boas-Vindas */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Área do Empresário & Gestão Contábil
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Consulte suas guias de impostos, pague com PIX Copia e Cola instantâneo, envie suas notas fiscais com OCR automático e abra chamados diretos com seu contador.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://wa.me/${telefoneEscritorio}?text=Ol%C3%A1%2C+sou+da+empresa+${encodeURIComponent(
                user.nome
              )}+e+gostaria+de+um+suporte+cont%C3%A1bil.`}
              target="_blank"
              rel="noreferrer"
              className="sm:hidden px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={() => setModalDuvidaAberta(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-xs shadow-lg shadow-teal-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Abrir Dúvida ao Contador</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 1: MEUS IMPOSTOS & GUIAS FISCAIS                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Meus Impostos & Guias a Pagar</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {impostos.filter((i) => i.status !== "PAGO").length} guias pendentes
            </span>
          </div>

          {impostos.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500">
                <FileText className="w-6 h-6 text-emerald-500/60" />
              </div>
              <p className="text-sm font-semibold text-white">Nenhum imposto cadastrado no momento</p>
              <p className="text-xs text-slate-400 max-w-md">
                Todas as guias fiscais estão em dia ou ainda não foram emitidas pelo seu escritório contábil para este período.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {impostos.map((guia) => {
                const isVencido = new Date(guia.data_vencimento) < new Date();
                const statusBadge =
                  guia.status === "PAGO"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : isVencido
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30";

                return (
                  <div
                    key={guia.id}
                    className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-bold text-white">{guia.titulo}</span>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            Competência: {guia.competencia} • {guia.tipo_guia}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${statusBadge}`}
                        >
                          {guia.status === "PAGO"
                            ? "Pago"
                            : isVencido
                            ? "Vencido"
                            : "A Vencer"}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between mt-3">
                        <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(guia.valor)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" /> Vence em {guia.data_vencimento}
                        </span>
                      </div>
                    </div>

                    {/* Ações Rápidas de Pagamento */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      {guia.codigo_pix && (
                        <button
                          onClick={() => copiarPix(guia.id, guia.codigo_pix!)}
                          className="w-full py-2.5 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          {chaveCopiadaId === guia.id ? (
                            <>
                              <Check className="w-4 h-4 text-teal-400" />
                              <span>Chave PIX Copiada!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copiar Código PIX (Copia e Cola)</span>
                            </>
                          )}
                        </button>
                      )}

                      {guia.linha_digitavel && (
                        <button
                          onClick={() => copiarLinha(guia.id, guia.linha_digitavel!)}
                          className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          {linhaCopiadaId === guia.id ? (
                            <span className="text-emerald-400">Código de Barras Copiado!</span>
                          ) : (
                            <span>Copiar Linha Digitável do Boleto</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 2: ENVIO DE NOTAS FISCAIS & EXTRATOS (DRAG & DROP)   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Envio de Arquivos & Extratos com OCR</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">{documentos.length} enviados</span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition flex flex-col items-center justify-center gap-3 cursor-pointer ${
              dragOver
                ? "border-teal-400 bg-teal-500/5"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-teal-400 shadow-inner">
              <Upload className={`w-6 h-6 ${enviandoArquivos ? "animate-bounce" : ""}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {enviandoArquivos
                  ? "Enviando e processando arquivo com OCR..."
                  : "Arraste seus arquivos XML (NF-e/NFC-e), extratos OFX ou recibos aqui"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Formatos aceitos: .xml, .pdf, .ofx, .png, .jpg (Até 25MB)
              </p>
            </div>
            <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition">
              Selecionar do Computador
              <input
                type="file"
                multiple
                disabled={enviandoArquivos}
                className="hidden"
                accept=".xml,.pdf,.ofx,.png,.jpg,.jpeg,.webp,.txt"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </label>
          </div>

          {/* Histórico Real de Documentos Enviados pelo Cliente */}
          {documentos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Documentos Processados no Escritório:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {documentos.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
                          {doc.file_extension.toLowerCase() === ".xml" ? (
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{doc.titulo}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{doc.file_name}</p>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                          doc.status === "PROCESSADO"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : doc.status === "REJEITADO"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {doc.status === "PROCESSADO"
                          ? "Auditado"
                          : doc.status === "REJEITADO"
                          ? "Inconsistente"
                          : "Em Análise"}
                      </span>
                    </div>

                    {/* Exibe Motivo de Rejeição caso o Contador tenha apontado problema */}
                    {doc.status === "REJEITADO" && doc.motivo_rejeicao && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-300">
                        <span className="font-bold flex items-center gap-1 text-rose-400 mb-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Observação do Contador:
                        </span>
                        <p>{doc.motivo_rejeicao}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 3: HISTÓRICO DE DÚVIDAS & ATENDIMENTO                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white">Minhas Dúvidas & Atendimentos</h2>
            </div>
            <button
              onClick={() => setModalDuvidaAberta(true)}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Dúvida</span>
            </button>
          </div>

          {solicitacoes.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500">
                <MessageSquare className="w-6 h-6 text-blue-400/60" />
              </div>
              <p className="text-sm font-semibold text-white">Nenhum chamado aberto</p>
              <p className="text-xs text-slate-400 max-w-md">
                Você não possui nenhuma dúvida ou chamado em andamento. Clique em &ldquo;Abrir Dúvida ao Contador&rdquo; para iniciar um novo atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {solicitacoes.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.assunto}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                        item.status === "CONCLUIDO" || item.status === "RESPONDIDO"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {item.status === "CONCLUIDO" || item.status === "RESPONDIDO"
                        ? "Respondido"
                        : "Em Triagem"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    &ldquo;{item.descricao}&rdquo;
                  </p>
                  {item.resposta && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                      <p className="font-semibold text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resposta Oficial do Escritório:
                      </p>
                      <p className="leading-relaxed">{item.resposta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Abertura de Nova Dúvida com IA */}
      {modalDuvidaAberta && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Nova Dúvida Contábil / Fiscal</h3>
              </div>
              <button
                onClick={() => setModalDuvidaAberta(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={enviarNovaDuvida} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Assunto da Dúvida *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Emissão de nota fiscal de serviço ou cálculo de alíquota"
                  value={novaDuvidaAssunto}
                  onChange={(e) => setNovaDuvidaAssunto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-3 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Descreva sua Dúvida *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explique o que precisa. O Copiloto de IA fará a triagem inicial e seu contador responderá..."
                  value={novaDuvidaTexto}
                  onChange={(e) => setNovaDuvidaTexto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-3 outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalDuvidaAberta(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoDuvida}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold text-xs shadow-lg shadow-teal-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {salvandoDuvida ? "Enviando..." : "Enviar Chamado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
