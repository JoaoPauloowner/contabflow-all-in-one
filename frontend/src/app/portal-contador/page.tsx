"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearSession, UserSession, fetchWithAuth } from "@/lib/api";
import {
  Building2,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Send,
  X,
  MessageSquare,
  LogOut,
  Plus,
  RefreshCw,
  Bot,
  Inbox,
  QrCode,
  Settings,
  ShieldCheck,
  Phone,
  Mail,
  Copy,
  Check,
  Radio,
  ExternalLink,
  DollarSign,
  Calendar,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileCheck,
  FileX,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Filter,
  Search,
  CheckCheck,
  UploadCloud,
  BookOpen,
  Tag,
  Trash2,
  Edit3,
  Lightbulb,
  BookMarked,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";

interface ChamadoItem {
  id: string;
  cliente_id?: string;
  cliente_nome: string;
  assunto: string;
  descricao: string;
  departamento: string;
  prioridade: string;
  origem: string;
  status: string;
  created_at: string;
}

interface RascunhoItem {
  id: string;
  solicitacao_id: string;
  status: string;
  conteudo_original: string;
  conteudo_editado?: string;
  confianca: string;
  modelo_llm: string;
  fontes_usadas_json?: string;
}

interface ClienteItem {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf: string;
  email: string;
  telefone_whatsapp: string;
  regime_tributario: string;
  ativo: boolean;
  created_at: string;
}

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

interface EscritorioData {
  tenant_id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  plano: string;
  ativo: boolean;
  created_at: string;
  total_clientes: number;
  total_usuarios: number;
}

export interface DocumentoItem {
  id: string;
  tenant_id: string;
  cliente_id: string;
  titulo: string;
  tipo: string;
  competencia: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_extension: string;
  status: "PENDENTE" | "PROCESSADO" | "REJEITADO";
  enviado_por: string;
  motivo_rejeicao?: string;
  chave_acesso?: string;
  valor_total?: number;
  cnpj_emitente?: string;
  score_confianca?: number;
  dados_extraidos_json?: string;
  created_at: string;
}

export interface ArtigoConhecimentoItem {
  id: string;
  tenant_id: string;
  titulo: string;
  conteudo: string;
  departamento: "fiscal" | "contabil" | "folha" | "societario" | "geral";
  tags?: string;
  status: "rascunho" | "publicado" | "arquivado";
  criado_por: string;
  publicado_por?: string;
  created_at: string;
  updated_at: string;
}

type TabType = "cockpit" | "clientes" | "documentos" | "conhecimento" | "whatsapp" | "escritorio";

export default function PortalContadorPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<TabType>("cockpit");
  const [tema, setTema] = useState<"dark" | "light">("dark");

  // Dados do Sistema
  const [chamados, setChamados] = useState<ChamadoItem[]>([]);
  const [rascunhos, setRascunhos] = useState<RascunhoItem[]>([]);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [escritorio, setEscritorio] = useState<EscritorioData | null>(null);
  const [impostos, setImpostos] = useState<ImpostoItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [artigos, setArtigos] = useState<ArtigoConhecimentoItem[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    isConnected: boolean;
    userPhone?: string | null;
    hasQR?: boolean;
    qrDataUrl?: string | null;
  }>({ isConnected: false });

  // Estados da Base de Conhecimento & Treinamento da IA (RAG)
  const [artigoSelecionado, setArtigoSelecionado] = useState<ArtigoConhecimentoItem | null>(null);
  const [filtroDeptArtigo, setFiltroDeptArtigo] = useState<string>("TODOS");
  const [buscaArtigo, setBuscaArtigo] = useState<string>("");
  const [modalArtigoAberto, setModalArtigoAberto] = useState<boolean>(false);
  const [modoEdicaoArtigo, setModoEdicaoArtigo] = useState<boolean>(false);
  const [salvandoArtigo, setSalvandoArtigo] = useState<boolean>(false);
  const [excluindoArtigoId, setExcluindoArtigoId] = useState<string | null>(null);
  const [formArtigo, setFormArtigo] = useState({
    id: "",
    titulo: "",
    conteudo: "",
    departamento: "geral",
    tags: "",
    status: "publicado",
  });

  // Estados da Fila de Auditoria & Visualizador Tripartite de Documentos
  const [documentoSelecionado, setDocumentoSelecionado] = useState<DocumentoItem | null>(null);
  const [filtroTipoDoc, setFiltroTipoDoc] = useState<string>("TODOS");
  const [filtroStatusDoc, setFiltroStatusDoc] = useState<string>("TODOS");
  const [buscaDoc, setBuscaDoc] = useState<string>("");
  const [zoomNivel, setZoomNivel] = useState<number>(100);
  const [rotacao, setRotacao] = useState<number>(0);
  const [modalRejeicaoAberto, setModalRejeicaoAberto] = useState<boolean>(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState<string>("");
  const [notificarZapRejeicao, setNotificarZapRejeicao] = useState<boolean>(true);
  const [rejeitandoDoc, setRejeitandoDoc] = useState<boolean>(false);
  const [conteudoTextoDoc, setConteudoTextoDoc] = useState<string | null>(null);
  const [carregandoTexto, setCarregandoTexto] = useState<boolean>(false);
  const [abaPreviewXml, setAbaPreviewXml] = useState<"danfe" | "codigo">("danfe");
  const [modalUploadDocAberto, setModalUploadDocAberto] = useState<boolean>(false);
  const [salvandoUploadDoc, setSalvandoUploadDoc] = useState<boolean>(false);
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null);
  const [formUploadDoc, setFormUploadDoc] = useState({
    cliente_id: "",
    titulo: "",
    tipo: "NFE",
    competencia: "03/2026",
  });

  // Estados de Interação
  const [chamadoSelecionado, setChamadoSelecionado] = useState<ChamadoItem | null>(null);
  const [filtroStatusChamados, setFiltroStatusChamados] = useState<"PENDENTES" | "RESPONDIDOS" | "TODOS">("PENDENTES");
  const chamadoSelecionadoRef = useRef<ChamadoItem | null>(null);
  const documentoSelecionadoRef = useRef<DocumentoItem | null>(null);
  const artigoSelecionadoRef = useRef<ArtigoConhecimentoItem | null>(null);
  const [rascunhoTexto, setRascunhoTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [modalQrAberto, setModalQrAberto] = useState(false);
  const [notificacao, setNotificacao] = useState<string | null>(null);
  const [tenantCopiado, setTenantCopiado] = useState(false);
  const [mostrarChaveWebhook, setMostrarChaveWebhook] = useState(false);
  const [chaveWebhookCopiada, setChaveWebhookCopiada] = useState(false);

  // Modal 1: Novo Cliente
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [formCliente, setFormCliente] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj_cpf: "",
    email: "",
    telefone_whatsapp: "",
    regime_tributario: "SIMPLES_NACIONAL",
    criar_usuario_acesso: true,
    usuario_senha: "",
  });

  // Modal 2: Novo Chamado
  const [modalNovoChamadoAberto, setModalNovoChamadoAberto] = useState(false);
  const [salvandoChamado, setSalvandoChamado] = useState(false);
  const [formChamado, setFormChamado] = useState({
    cliente_id: "",
    cliente_nome: "",
    assunto: "",
    descricao: "",
    departamento: "FISCAL",
    prioridade: "MEDIA",
    origem: "PORTAL",
  });

  // Modal 3: Nova Guia Fiscal
  const [modalNovaGuiaAberto, setModalNovaGuiaAberto] = useState(false);
  const [salvandoGuia, setSalvandoGuia] = useState(false);
  const [formGuia, setFormGuia] = useState({
    cliente_id: "",
    titulo: "",
    tipo_guia: "DAS",
    competencia: "",
    data_vencimento: "",
    valor: "",
    linha_digitavel: "",
    codigo_pix: "",
  });

  const carregarDados = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      // 1. Rascunhos de IA primeiro (para sincronizar com chamados)
      let rascunhosAtuais: RascunhoItem[] = [];
      const resRascunhos = await fetchWithAuth("/api/v1/ia/rascunhos");
      if (resRascunhos.ok) {
        rascunhosAtuais = await resRascunhos.json();
        setRascunhos(rascunhosAtuais);
      }

      // 2. Chamados do Helpdesk
      const resChamados = await fetchWithAuth("/api/v1/solicitacoes");
      if (resChamados.ok) {
        const dados: ChamadoItem[] = await resChamados.json();
        setChamados(dados);
        // Se ainda não selecionou nenhum chamado, seleciona o primeiro
        if (dados.length > 0 && !chamadoSelecionadoRef.current) {
          selecionarChamado(dados[0], rascunhosAtuais);
        } else if (chamadoSelecionadoRef.current) {
          // Mantém o chamado selecionado atualizado em segundo plano sem trocar de tela
          const chamadoAtual = dados.find((c) => c.id === chamadoSelecionadoRef.current?.id);
          if (chamadoAtual) {
            chamadoSelecionadoRef.current = chamadoAtual;
            setChamadoSelecionado(chamadoAtual);
          }
        }
      }

      // 3. Clientes do Escritório
      const resClientes = await fetchWithAuth("/api/v1/clientes");
      if (resClientes.ok) {
        const dados = await resClientes.json();
        setClientes(dados);
      }

      // 4. Dados do Escritório (Tenant)
      const resEscritorio = await fetchWithAuth("/api/v1/auth/escritorio");
      if (resEscritorio.ok) {
        const dados = await resEscritorio.json();
        setEscritorio(dados);
      }

      // 5. Impostos / Guias Fiscais
      const resImpostos = await fetchWithAuth("/api/v1/impostos");
      if (resImpostos.ok) {
        const dados = await resImpostos.json();
        setImpostos(dados);
      }

      // 6. Documentos Fiscais & OCR
      const resDocumentos = await fetchWithAuth("/api/v1/documentos");
      if (resDocumentos.ok) {
        const dadosDocs: DocumentoItem[] = await resDocumentos.json();
        setDocumentos(dadosDocs);
        if (dadosDocs.length > 0 && !documentoSelecionadoRef.current) {
          selecionarDocumento(dadosDocs[0]);
        }
      }

      // 7. Base de Conhecimento & Treinamento da IA (RAG)
      const resArtigos = await fetchWithAuth("/api/v1/conhecimento");
      if (resArtigos.ok) {
        const dadosArtigos: ArtigoConhecimentoItem[] = await resArtigos.json();
        setArtigos(dadosArtigos);
        if (dadosArtigos.length > 0 && !artigoSelecionadoRef.current) {
          artigoSelecionadoRef.current = dadosArtigos[0];
          setArtigoSelecionado(dadosArtigos[0]);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados do backend:", e);
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  const selecionarDocumento = async (doc: DocumentoItem) => {
    documentoSelecionadoRef.current = doc;
    setDocumentoSelecionado(doc);
    setZoomNivel(100);
    setRotacao(0);
    setConteudoTextoDoc(null);

    const ext = doc.file_extension.toLowerCase();
    if (ext === ".xml" || ext === ".ofx" || ext === ".txt" || ext === ".csv") {
      setCarregandoTexto(true);
      try {
        const res = await fetchWithAuth(`/api/v1/documentos/${doc.id}/conteudo-texto`);
        if (res.ok) {
          const data = await res.json();
          setConteudoTextoDoc(data.conteudo);
        }
      } catch (err) {
        console.error("Erro ao buscar conteúdo de texto:", err);
      } finally {
        setCarregandoTexto(false);
      }
    }
  };

  const aprovarDocumento = async (docId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/documentos/${docId}/auditar`, {
        method: "POST",
        body: JSON.stringify({ status: "PROCESSADO" }),
      });
      if (res.ok) {
        const docAtualizado = await res.json();
        setNotificacao("✅ Documento auditado e validado com sucesso!");
        setDocumentos((prev) => prev.map((d) => (d.id === docId ? docAtualizado : d)));
        if (documentoSelecionado?.id === docId) {
          setDocumentoSelecionado(docAtualizado);
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao aprovar documento.");
      }
    } catch (e) {
      setNotificacao("Erro ao aprovar documento.");
    }
    setTimeout(() => setNotificacao(null), 6000);
  };

  const confirmarRejeicaoDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentoSelecionado) return;
    if (!motivoRejeicao.trim()) {
      alert("Por favor, descreva o motivo da rejeição do documento.");
      return;
    }

    setRejeitandoDoc(true);
    try {
      const res = await fetchWithAuth(`/api/v1/documentos/${documentoSelecionado.id}/auditar`, {
        method: "POST",
        body: JSON.stringify({
          status: "REJEITADO",
          motivo_rejeicao: motivoRejeicao.trim(),
        }),
      });

      if (res.ok) {
        const docAtualizado = await res.json();
        setNotificacao("⚠️ Documento rejeitado e registrado na auditoria contábil.");
        setDocumentos((prev) => prev.map((d) => (d.id === docAtualizado.id ? docAtualizado : d)));
        setDocumentoSelecionado(docAtualizado);
        setModalRejeicaoAberto(false);
        setMotivoRejeicao("");
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao rejeitar documento.");
      }
    } catch (e) {
      alert("Erro ao comunicar com o servidor para rejeitar documento.");
    } finally {
      setRejeitandoDoc(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const reprocessarOcrDocumento = async (docId: string) => {
    setNotificacao("⚡ Acionando motor de OCR & IA fiscal para reprocessar...");
    try {
      const res = await fetchWithAuth(`/api/v1/documentos/${docId}/extrair-ocr`, {
        method: "POST",
      });
      if (res.ok) {
        const docAtualizado = await res.json();
        setNotificacao("✨ OCR e análise fiscal concluídos com sucesso!");
        setDocumentos((prev) => prev.map((d) => (d.id === docId ? docAtualizado : d)));
        if (documentoSelecionado?.id === docId) {
          setDocumentoSelecionado(docAtualizado);
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao reprocessar OCR.");
      }
    } catch (e) {
      alert("Erro ao reprocessar OCR.");
    }
    setTimeout(() => setNotificacao(null), 6000);
  };

  const handleUploadDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivoUpload) {
      alert("Por favor, selecione um arquivo.");
      return;
    }
    if (!formUploadDoc.cliente_id) {
      alert("Por favor, selecione o cliente destinatário.");
      return;
    }

    setSalvandoUploadDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", arquivoUpload);
      formData.append("titulo", formUploadDoc.titulo || arquivoUpload.name);
      formData.append("tipo", formUploadDoc.tipo);
      formData.append("competencia", formUploadDoc.competencia);
      formData.append("cliente_id", formUploadDoc.cliente_id);

      const res = await fetchWithAuth("/api/v1/documentos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro no upload.");
      }

      const novoDoc = await res.json();
      setNotificacao(`✅ Documento "${novoDoc.titulo}" enviado e processado com OCR!`);
      setModalUploadDocAberto(false);
      setArquivoUpload(null);
      setFormUploadDoc({
        cliente_id: "",
        titulo: "",
        tipo: "NFE",
        competencia: "03/2026",
      });
      setDocumentos((prev) => [novoDoc, ...prev]);
      selecionarDocumento(novoDoc);
    } catch (err: any) {
      alert(err.message || "Erro no envio do documento.");
    } finally {
      setSalvandoUploadDoc(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  useEffect(() => {
    // Inicialização e persistência do tema (Claro / Escuro)
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
    if (!storedUser || storedUser.role === "CLIENTE") {
      router.replace("/login");
      return;
    }
    setUser(storedUser);
    carregarDados();

    // Polling contínuo do status do microserviço WhatsApp Bridge / Evolution API
    const checarStatusWhatsApp = async () => {
      try {
        const res = await fetch("/api/v1/whatsapp/status");
        if (res.ok) {
          const data = await res.json();
          setWhatsappStatus(data);
        }
      } catch {
        // Bridge offline ou iniciando
      }
    };

    checarStatusWhatsApp();
    const interval = setInterval(checarStatusWhatsApp, 3000);
    const intervalDados = setInterval(() => {
      carregarDados(true);
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(intervalDados);
    };
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

  const gerarRespostaIa = async (solicitacaoId: string) => {
    setGerandoIa(true);
    try {
      const res = await fetchWithAuth(`/api/v1/ia/rascunhos/gerar/${solicitacaoId}`, {
        method: "POST",
      });
      if (res.ok) {
        const novoRascunho = await res.json();
        setRascunhos((prev) => [novoRascunho, ...prev.filter((r) => r.id !== novoRascunho.id)]);
        setRascunhoTexto(novoRascunho.conteudo_original);
        setNotificacao("✨ Proposta técnica gerada com sucesso pela IA via Base de Conhecimento!");
      }
    } catch (err) {
      console.error("Erro ao gerar resposta com IA:", err);
    } finally {
      setGerandoIa(false);
      setTimeout(() => setNotificacao(null), 5000);
    }
  };

  const selecionarChamado = async (chamado: ChamadoItem, rascunhosLista?: RascunhoItem[]) => {
    chamadoSelecionadoRef.current = chamado;
    setChamadoSelecionado(chamado);
    const lista = rascunhosLista || rascunhos;
    const rascunhoVinculado = lista.find((r) => r.solicitacao_id === chamado.id);
    if (rascunhoVinculado && (rascunhoVinculado.conteudo_editado || rascunhoVinculado.conteudo_original)) {
      setRascunhoTexto(rascunhoVinculado.conteudo_editado || rascunhoVinculado.conteudo_original);
    } else {
      setRascunhoTexto("");
      gerarRespostaIa(chamado.id);
    }
  };

  const aprovarRascunho = async () => {
    if (!chamadoSelecionado) return;
    if (!rascunhoTexto.trim()) {
      alert("Por favor, digite ou gere uma proposta de resposta antes de enviar ao cliente.");
      return;
    }

    setEnviandoResposta(true);
    try {
      let rascunhoVinculado = rascunhos.find((r) => r.solicitacao_id === chamadoSelecionado.id);

      // Se ainda não existia rascunho cadastrado, gera primeiro
      if (!rascunhoVinculado) {
        const resNovo = await fetchWithAuth(`/api/v1/ia/rascunhos/gerar/${chamadoSelecionado.id}`, {
          method: "POST",
        });
        if (resNovo.ok) {
          rascunhoVinculado = await resNovo.json();
          setRascunhos((prev) => [rascunhoVinculado!, ...prev]);
        }
      }

      if (!rascunhoVinculado) {
        throw new Error("Não foi possível inicializar o protocolo de aprovação.");
      }

      const res = await fetchWithAuth(`/api/v1/ia/rascunhos/${rascunhoVinculado.id}/aprovar`, {
        method: "POST",
        body: JSON.stringify({
          despachar_whatsapp: true,
          conteudo_final: rascunhoTexto.trim(),
        }),
      });

      if (res.ok) {
        if (!whatsappStatus.isConnected) {
          setModalQrAberto(true);
          setNotificacao(
            `⚠️ Resposta registrada no chamado! Porém o WhatsApp está DESCONECTADO. Escaneie o QR Code para entregar no aparelho!`
          );
        } else {
          setNotificacao(
            `✅ Resposta técnica aprovada e entregue no WhatsApp de ${chamadoSelecionado.cliente_nome}!`
          );
        }
        carregarDados();
        setChamadoSelecionado(null);
        setRascunhoTexto("");
      } else {
        let erroMsg = "Erro ao aprovar e despachar resposta.";
        try {
          const err = await res.json();
          erroMsg = err.detail || erroMsg;
        } catch {
          try {
            const txt = await res.text();
            if (txt) erroMsg = txt;
          } catch {}
        }
        alert(erroMsg);
      }
    } catch (e: any) {
      alert(e.message || "Erro ao aprovar rascunho.");
    } finally {
      setEnviandoResposta(false);
      setTimeout(() => setNotificacao(null), 8000);
    }
  };

  const handleCadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoCliente(true);
    try {
      const res = await fetchWithAuth("/api/v1/clientes", {
        method: "POST",
        body: JSON.stringify(formCliente),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.detail || "Erro ao cadastrar cliente.");
      }

      setNotificacao(`✅ Empresa ${formCliente.razao_social} cadastrada com sucesso!`);
      setModalNovoClienteAberto(false);
      setFormCliente({
        razao_social: "",
        nome_fantasia: "",
        cnpj_cpf: "",
        email: "",
        telefone_whatsapp: "",
        regime_tributario: "SIMPLES_NACIONAL",
        criar_usuario_acesso: true,
        usuario_senha: "",
      });
      carregarDados();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar cliente.");
    } finally {
      setSalvandoCliente(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const handleCriarChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoChamado(true);
    try {
      const clienteSelecionado = clientes.find((c) => c.id === formChamado.cliente_id);
      const payload = {
        cliente_id: formChamado.cliente_id || undefined,
        cliente_nome: clienteSelecionado
          ? clienteSelecionado.nome_fantasia || clienteSelecionado.razao_social
          : formChamado.cliente_nome || "Cliente Geral",
        assunto: formChamado.assunto,
        descricao: formChamado.descricao,
        departamento: formChamado.departamento.toLowerCase(),
        prioridade: formChamado.prioridade.toLowerCase(),
        origem: formChamado.origem.toLowerCase(),
      };

      const res = await fetchWithAuth("/api/v1/solicitacoes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "Erro ao abrir chamado.";
        try {
          const erro = await res.json();
          if (Array.isArray(erro.detail)) {
            msg = erro.detail.map((d: any) => d.msg || `${d.loc?.join(".")}: ${d.type}`).join("\n");
          } else if (typeof erro.detail === "string") {
            msg = erro.detail;
          }
        } catch {
          msg = await res.text();
        }
        throw new Error(msg);
      }

      setNotificacao(`✅ Chamado "${formChamado.assunto}" aberto com sucesso!`);
      setModalNovoChamadoAberto(false);
      setFormChamado({
        cliente_id: "",
        cliente_nome: "",
        assunto: "",
        descricao: "",
        departamento: "FISCAL",
        prioridade: "MEDIA",
        origem: "PORTAL",
      });
      carregarDados();
    } catch (err: any) {
      alert(err.message || "Erro ao abrir chamado.");
    } finally {
      setSalvandoChamado(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const handleEmitirGuia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGuia.cliente_id) {
      alert("Por favor, selecione uma empresa cliente.");
      return;
    }
    setSalvandoGuia(true);
    try {
      const valorNum = parseFloat(formGuia.valor.replace(/\./g, "").replace(",", ".")) || 0;
      const payload = {
        cliente_id: formGuia.cliente_id,
        titulo: formGuia.titulo,
        tipo_guia: formGuia.tipo_guia,
        competencia: formGuia.competencia,
        data_vencimento: formGuia.data_vencimento,
        valor: valorNum,
        linha_digitavel: formGuia.linha_digitavel || undefined,
        codigo_pix: formGuia.codigo_pix || undefined,
      };

      const res = await fetchWithAuth("/api/v1/impostos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.detail || "Erro ao emitir guia.");
      }

      setNotificacao(`✅ Guia "${formGuia.titulo}" emitida com sucesso!`);
      setModalNovaGuiaAberto(false);
      setFormGuia({
        cliente_id: "",
        titulo: "",
        tipo_guia: "DAS",
        competencia: "",
        data_vencimento: "",
        valor: "",
        linha_digitavel: "",
        codigo_pix: "",
      });
      carregarDados();
    } catch (err: any) {
      alert(err.message || "Erro ao emitir guia.");
    } finally {
      setSalvandoGuia(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const copiarTenantId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.tenant_id);
    setTenantCopiado(true);
    setTimeout(() => setTenantCopiado(false), 2500);
  };

  if (!user) return null;

  const totalGuiasAVencer = impostos.filter((i) => i.status === "A_VENCER").length;
  const nomeExibicaoEscritorio =
    escritorio?.nome && escritorio.nome.trim() !== ""
      ? escritorio.nome
      : `Escritório de: ${user?.nome || "Contador"}`;

  const dadosOcr = (() => {
    if (!documentoSelecionado?.dados_extraidos_json) return null;
    try {
      return JSON.parse(documentoSelecionado.dados_extraidos_json);
    } catch {
      return null;
    }
  })();

  const documentosFiltrados = documentos.filter((doc) => {
    if (filtroStatusDoc !== "TODOS" && doc.status !== filtroStatusDoc) return false;
    if (filtroTipoDoc !== "TODOS" && doc.tipo !== filtroTipoDoc) return false;
    if (buscaDoc.trim()) {
      const q = buscaDoc.toLowerCase();
      const tituloMatch = doc.titulo?.toLowerCase().includes(q);
      const nomeMatch = doc.file_name?.toLowerCase().includes(q);
      const chaveMatch = doc.chave_acesso?.toLowerCase().includes(q);
      const clienteMatch = clientes.find((c) => c.id === doc.cliente_id)?.razao_social.toLowerCase().includes(q);
      const emitenteMatch = doc.cnpj_emitente?.toLowerCase().includes(q);
      if (!tituloMatch && !nomeMatch && !chaveMatch && !clienteMatch && !emitenteMatch) return false;
    }
    return true;
  });

  const abrirModalNovoArtigo = () => {
    setModoEdicaoArtigo(false);
    setFormArtigo({
      id: "",
      titulo: "",
      conteudo: "",
      departamento: "geral",
      tags: "",
      status: "publicado",
    });
    setModalArtigoAberto(true);
  };

  const abrirModalEditarArtigo = (artigo: ArtigoConhecimentoItem) => {
    setModoEdicaoArtigo(true);
    setFormArtigo({
      id: artigo.id,
      titulo: artigo.titulo,
      conteudo: artigo.conteudo,
      departamento: artigo.departamento || "geral",
      tags: artigo.tags || "",
      status: artigo.status || "publicado",
    });
    setModalArtigoAberto(true);
  };

  const aplicarTemplateArtigo = (titulo: string, dept: string, tags: string, conteudo: string) => {
    setModoEdicaoArtigo(false);
    setFormArtigo({
      id: "",
      titulo,
      conteudo,
      departamento: dept,
      tags,
      status: "publicado",
    });
    setModalArtigoAberto(true);
  };

  const handleSalvarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formArtigo.titulo.trim() || !formArtigo.conteudo.trim()) {
      alert("Por favor, preencha o título e o conteúdo da orientação.");
      return;
    }
    setSalvandoArtigo(true);
    try {
      const endpoint = modoEdicaoArtigo
        ? `/api/v1/conhecimento/${formArtigo.id}`
        : "/api/v1/conhecimento";
      const method = modoEdicaoArtigo ? "PUT" : "POST";

      const payload = {
        titulo: formArtigo.titulo.trim(),
        conteudo: formArtigo.conteudo.trim(),
        departamento: formArtigo.departamento,
        tags: formArtigo.tags.trim() || undefined,
        status: formArtigo.status,
      };

      const res = await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `Erro no servidor (${res.status})`;
        try {
          const erro = await res.json();
          msg = erro.detail || msg;
        } catch {
          // Response was not JSON
        }
        throw new Error(msg);
      }

      const artigoSalvo: ArtigoConhecimentoItem = await res.json();
      setNotificacao(
        modoEdicaoArtigo
          ? `✅ Artigo "${artigoSalvo.titulo}" atualizado com sucesso!`
          : `✅ Nova regra "${artigoSalvo.titulo}" cadastrada na IA!`
      );
      setModalArtigoAberto(false);

      if (modoEdicaoArtigo) {
        setArtigos((prev) => prev.map((a) => (a.id === artigoSalvo.id ? artigoSalvo : a)));
        setArtigoSelecionado(artigoSalvo);
      } else {
        setArtigos((prev) => [artigoSalvo, ...prev]);
        setArtigoSelecionado(artigoSalvo);
      }
    } catch (err: any) {
      alert(err.message || "Erro ao salvar artigo na base de conhecimento.");
    } finally {
      setSalvandoArtigo(false);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const handleExcluirArtigo = async (id: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja excluir o artigo "${titulo}" da base de conhecimento da IA?`)) {
      return;
    }
    setExcluindoArtigoId(id);
    try {
      const res = await fetchWithAuth(`/api/v1/conhecimento/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotificacao(`🗑️ Artigo "${titulo}" removido da base da IA.`);
        const novaLista = artigos.filter((a) => a.id !== id);
        setArtigos(novaLista);
        if (artigoSelecionado?.id === id) {
          setArtigoSelecionado(novaLista.length > 0 ? novaLista[0] : null);
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao excluir artigo.");
      }
    } catch (e) {
      setNotificacao("Erro ao excluir artigo.");
    } finally {
      setExcluindoArtigoId(null);
      setTimeout(() => setNotificacao(null), 6000);
    }
  };

  const artigosFiltrados = artigos.filter((art) => {
    if (filtroDeptArtigo !== "TODOS" && art.departamento !== filtroDeptArtigo.toLowerCase()) return false;
    if (buscaArtigo.trim()) {
      const q = buscaArtigo.toLowerCase();
      const tituloMatch = art.titulo?.toLowerCase().includes(q);
      const conteudoMatch = art.conteudo?.toLowerCase().includes(q);
      const tagsMatch = art.tags?.toLowerCase().includes(q);
      if (!tituloMatch && !conteudoMatch && !tagsMatch) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Barra Superior */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-lg leading-none">
                  Contab<span className="text-emerald-400">Flow</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold uppercase">
                  Cockpit 360°
                </span>
              </div>
              {/* Item 1: Nome Fantasia do Escritório Contábil em substituição ao ID bruto */}
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-slate-300 truncate max-w-[180px] sm:max-w-xs">
                  {nomeExibicaoEscritorio}
                </span>
              </div>
            </div>
          </div>

          {/* Abas de Navegação Principal */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-2xl border border-slate-800/80 text-xs font-medium">
            <button
              onClick={() => setAbaAtiva("cockpit")}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                abaAtiva === "cockpit"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cockpit 360°</span>
            </button>

            <button
              onClick={() => setAbaAtiva("clientes")}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                abaAtiva === "clientes"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {clientes.length}
              </span>
            </button>

            <button
              onClick={() => setAbaAtiva("documentos")}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                abaAtiva === "documentos"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Documentos & OCR</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {documentos.length}
              </span>
            </button>

            {/* Item 4: Base de Conhecimento & Treinamento da IA */}
            <button
              onClick={() => setAbaAtiva("conhecimento")}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                abaAtiva === "conhecimento"
                  ? "bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Base de Conhecimento (IA)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {artigos.length}
              </span>
            </button>

            {/* Item 5: Badge e Botao de Conexao Direta do WhatsApp */}
            <button
              onClick={() => setModalQrAberto(true)}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer border ${
                whatsappStatus.isConnected
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
              }`}
              title={whatsappStatus.isConnected ? "WhatsApp Conectado - Clique para detalhes" : "WhatsApp Desconectado - Clique para Conectar"}
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="font-semibold">WhatsApp</span>
              {whatsappStatus.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Conectado {whatsappStatus.userPhone ? `(+${whatsappStatus.userPhone})` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Conectar
                </span>
              )}
            </button>

            <button
              onClick={() => setAbaAtiva("escritorio")}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                abaAtiva === "escritorio"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Dados do Escritório</span>
            </button>
          </nav>
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
            onClick={() => carregarDados()}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white">{user.nome}</p>
            <p className="text-[10px] text-emerald-400 font-mono">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700/60 text-slate-400 transition cursor-pointer"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Barra de Abas Mobile */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-900/80 px-4 py-2 gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setAbaAtiva("cockpit")}
          className={`px-3 py-1 rounded-xl shrink-0 ${abaAtiva === "cockpit" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400"}`}
        >
          Cockpit 360°
        </button>
        <button
          onClick={() => setAbaAtiva("clientes")}
          className={`px-3 py-1 rounded-xl shrink-0 ${abaAtiva === "clientes" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400"}`}
        >
          Clientes ({clientes.length})
        </button>
        <button
          onClick={() => setAbaAtiva("documentos")}
          className={`px-3 py-1 rounded-xl shrink-0 flex items-center gap-1.5 ${
            abaAtiva === "documentos" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400"
          }`}
        >
          <span>Docs & OCR</span>
          <span className="px-1 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {documentos.length}
          </span>
        </button>
        <button
          onClick={() => setAbaAtiva("conhecimento")}
          className={`px-3 py-1 rounded-xl shrink-0 flex items-center gap-1.5 ${
            abaAtiva === "conhecimento" ? "bg-purple-500/20 text-purple-300 font-semibold" : "text-slate-400"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Base IA ({artigos.length})</span>
        </button>
        <button
          onClick={() => setAbaAtiva("whatsapp")}
          className={`px-3 py-1 rounded-xl shrink-0 flex items-center gap-1.5 ${
            abaAtiva === "whatsapp" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400"
          }`}
        >
          <span>WhatsApp Bridge</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              whatsappStatus.isConnected ? "bg-emerald-400" : "bg-rose-500"
            }`}
          />
        </button>
        <button
          onClick={() => setAbaAtiva("escritorio")}
          className={`px-3 py-1 rounded-xl shrink-0 ${abaAtiva === "escritorio" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400"}`}
        >
          Dados Escritório
        </button>
      </div>

      {/* Banner de Notificação Toast */}
      {notificacao && (
        <div className="fixed top-16 right-6 z-50 max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl shadow-emerald-500/10 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-200 font-medium leading-relaxed">{notificacao}</p>
        </div>
      )}

      {/* Conteúdo Central Conforme a Aba Selecionada */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ABA 1: COCKPIT 360° (VISÃO GERAL) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {abaAtiva === "cockpit" && (
          <div className="space-y-6">
            {/* Alerta de WhatsApp Desconectado */}
            {!whatsappStatus.isConnected && (
              <div className="p-4 bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-amber-500/20 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-200">WhatsApp Bridge Desconectado</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Para receber dúvidas de clientes no sistema e disparar respostas automáticas ao WhatsApp, conecte o aparelho escaneando o QR Code.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalQrAberto(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Conectar WhatsApp (QR Code)</span>
                </button>
              </div>
            )}

            {/* Bloco de Métricas Zero-Data Dinâmicas */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div 
                onClick={() => setAbaAtiva("clientes")}
                className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Clientes Ativos
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{clientes.length}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {clientes.length === 0 ? "Nenhum cliente cadastrado" : `${clientes.length} empresas ativas`}
                </span>
              </div>

              <div 
                onClick={() => setAbaAtiva("documentos")}
                className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg hover:border-teal-500/50 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                    Documentos & OCR
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mt-2">
                  {documentos.filter((d) => d.status === "PENDENTE").length}
                  <span className="text-xs font-normal text-slate-400 ml-1.5 font-mono">/ {documentos.length}</span>
                </p>
                <span className="text-[11px] text-teal-400/90 mt-1 block">
                  {documentos.length === 0
                    ? "Nenhum documento recebido"
                    : `${documentos.filter((d) => d.status === "PENDENTE").length} aguardando auditoria`}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Guias a Vencer
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{totalGuiasAVencer}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {totalGuiasAVencer === 0 ? "Nenhuma guia pendente" : `${totalGuiasAVencer} guias aguardando pagamento`}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Chamados Helpdesk
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{chamados.length}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {chamados.length === 0 ? "Nenhum chamado aberto" : `${chamados.length} em aberto`}
                </span>
              </div>

              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 shadow-glow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                    Copiloto de IA
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-400 mt-2">{rascunhos.length} Pendentes</p>
                <span className="text-[11px] text-emerald-300/80 mt-1 block">
                  {rascunhos.length === 0 ? "Nenhum rascunho pendente" : "Aguardando aprovação"}
                </span>
              </div>
            </div>

            {/* Painel Central: Chamados e IA Human-in-the-Loop */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Central de Atendimento (Painel Esquerdo) */}
              <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Central de Atendimento & Dúvidas</h2>
                      <span className="text-xs text-slate-400 font-mono">
                        {chamados.length} tickets registrados
                      </span>
                    </div>
                  </div>

                  {/* Item 3: Botão de Ação Rápida: Novo Chamado */}
                  <button
                    onClick={() => setModalNovoChamadoAberto(true)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-blue-400/50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Chamado</span>
                  </button>
                </div>

                {/* Abas de Filtragem de Status */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs">
                  <button
                    onClick={() => setFiltroStatusChamados("PENDENTES")}
                    className={`flex-1 py-1 px-2 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      filtroStatusChamados === "PENDENTES"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>Pendentes</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      filtroStatusChamados === "PENDENTES" ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-300"
                    }`}>
                      {chamados.filter((c) => c.status === "aberta" || c.status === "em_andamento").length}
                    </span>
                  </button>

                  <button
                    onClick={() => setFiltroStatusChamados("RESPONDIDOS")}
                    className={`flex-1 py-1 px-2 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      filtroStatusChamados === "RESPONDIDOS"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>Respondidos</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      filtroStatusChamados === "RESPONDIDOS" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-300"
                    }`}>
                      {chamados.filter((c) => c.status === "resolvida" || c.status === "aguardando_cliente").length}
                    </span>
                  </button>

                  <button
                    onClick={() => setFiltroStatusChamados("TODOS")}
                    className={`flex-1 py-1 px-2 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      filtroStatusChamados === "TODOS"
                        ? "bg-slate-700 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>Todos</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                      {chamados.length}
                    </span>
                  </button>
                </div>

                {/* Lista de Chamados Filtrada */}
                {(() => {
                  const chamadosFiltrados = chamados.filter((c) => {
                    if (filtroStatusChamados === "PENDENTES") {
                      return c.status === "aberta" || c.status === "em_andamento";
                    }
                    if (filtroStatusChamados === "RESPONDIDOS") {
                      return c.status === "resolvida" || c.status === "aguardando_cliente";
                    }
                    return true;
                  });

                  if (chamadosFiltrados.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800/70 flex items-center justify-center text-slate-400">
                          <Inbox className="w-5 h-5 stroke-1 text-slate-300" />
                        </div>
                        <p className="text-xs font-semibold text-slate-200">
                          {filtroStatusChamados === "PENDENTES"
                            ? "Nenhum chamado pendente de atendimento 🎉"
                            : filtroStatusChamados === "RESPONDIDOS"
                            ? "Nenhum chamado respondido no histórico"
                            : "Nenhum chamado registrado"}
                        </p>
                        {filtroStatusChamados === "PENDENTES" && (
                          <p className="text-[11px] text-slate-400 max-w-xs">
                            Sua caixa de atendimento está em dia! Dúvidas respondidas saem automaticamente da fila.
                          </p>
                        )}
                        <button
                          onClick={() => setModalNovoChamadoAberto(true)}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                        >
                          + Abrir Novo Chamado
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {chamadosFiltrados.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => selecionarChamado(item)}
                          className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col gap-2 ${
                            chamadoSelecionado?.id === item.id
                              ? "bg-slate-800 border-emerald-500 shadow-md shadow-emerald-500/5"
                              : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{item.cliente_nome}</span>
                            <div className="flex items-center gap-1.5">
                              {item.status === "aguardando_cliente" || item.status === "resolvida" ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Respondido
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Pendente
                                </span>
                              )}
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {item.departamento}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 font-medium">{item.assunto}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{item.descricao}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Copiloto de IA Contábil (Painel Direito) */}
              <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white">Copiloto IA Contábil</h2>
                        <span className="text-[10px] text-emerald-400 font-mono">Human-in-the-Loop</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono border border-slate-700">
                      Revisão Obrigatória
                    </span>
                  </div>

                  {/* Banner de status do WhatsApp se desconectado */}
                  {!whatsappStatus.isConnected && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2 text-xs text-amber-300 animate-pulse">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-semibold">WhatsApp Desconectado</span>
                      </div>
                      <button
                        onClick={() => setModalQrAberto(true)}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold rounded-lg border border-amber-500/30 transition cursor-pointer"
                      >
                        Conectar Agora
                      </button>
                    </div>
                  )}

                  {chamadoSelecionado ? (
                    <div className="space-y-3 animate-fade-in">
                      <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Dúvida do Cliente ({chamadoSelecionado.origem.toUpperCase()})
                        </p>
                        <p className="text-xs font-bold text-white mt-1">
                          {chamadoSelecionado.cliente_nome}
                        </p>
                        <p className="text-xs text-slate-300 mt-1 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          &ldquo;{chamadoSelecionado.descricao}&rdquo;
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-300">
                            Proposta de Resposta da IA (Editável)
                          </label>
                          <button
                            type="button"
                            onClick={() => gerarRespostaIa(chamadoSelecionado.id)}
                            disabled={gerandoIa}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className={`w-3 h-3 ${gerandoIa ? "animate-spin" : ""}`} />
                            <span>{gerandoIa ? "Consultando IA..." : "✨ Regenerar com IA (RAG)"}</span>
                          </button>
                        </div>
                        <textarea
                          rows={8}
                          value={rascunhoTexto}
                          onChange={(e) => setRascunhoTexto(e.target.value)}
                          placeholder="Carregando proposta da IA ou digite sua resposta..."
                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-200 rounded-2xl p-3.5 outline-none transition resize-none leading-relaxed font-sans"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={aprovarRascunho}
                          disabled={enviandoResposta || gerandoIa}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {enviandoResposta ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Enviando para o WhatsApp...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>Aprovar e Enviar ao WhatsApp</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Item 2: Empty State Copiloto com Contraste Alto */
                    <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/70 flex items-center justify-center text-slate-400">
                        <Bot className="w-6 h-6 stroke-1 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-200 text-sm">Nenhum chamado selecionado</p>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Selecione um chamado da lista ao lado para revisar a sugestão técnica da IA e despachar com 1 clique.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seção 3: Painel de Guias Fiscais & Cobrança (Painel Inferior) */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Painel de Guias Fiscais & Cobrança</h2>
                    <span className="text-xs text-slate-400 font-mono">
                      {impostos.length} guias cadastradas
                    </span>
                  </div>
                </div>

                {/* Item 3: Botões Alinhados à Direita: Cadastrar Cliente e Emitir Nova Guia */}
                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                  <button
                    onClick={() => setModalNovoClienteAberto(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cadastrar Cliente</span>
                  </button>
                  <button
                    onClick={() => setModalNovaGuiaAberto(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-semibold shadow-lg shadow-teal-600/20 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Emitir Nova Guia</span>
                  </button>
                </div>
              </div>

              {/* Item 2: Empty State com Contraste Alto ou Tabela Real de Guias */}
              {impostos.length === 0 ? (
                <div className="py-14 text-center text-slate-400 flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/70 flex items-center justify-center text-slate-400">
                    <FileText className="w-6 h-6 stroke-1 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Nenhuma guia de imposto cadastrada no momento</p>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    As guias emitidas (DAS, DARF, FGTS, ICMS) aparecerão nesta tabela para acompanhamento e régua de cobrança automática via WhatsApp.
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => setModalNovaGuiaAberto(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                    >
                      + Emitir Primeira Guia
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Título / Guia</th>
                        <th className="py-3.5 px-4">Tipo</th>
                        <th className="py-3.5 px-4">Competência</th>
                        <th className="py-3.5 px-4">Vencimento</th>
                        <th className="py-3.5 px-4">Valor</th>
                        <th className="py-3.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                      {impostos.map((imp) => (
                        <tr key={imp.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">{imp.titulo}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">{imp.tipo_guia}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">{imp.competencia}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {new Date(imp.data_vencimento).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            {Number(imp.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                imp.status === "PAGO"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : imp.status === "VENCIDO"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {imp.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ABA 2: GESTÃO DE CLIENTES & EMPRESAS */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {abaAtiva === "clientes" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>Gestão de Empresas Clientes</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre e gerencie as empresas atendidas pelo seu escritório contábil neste tenant.
                </p>
              </div>

              <button
                onClick={() => setModalNovoClienteAberto(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Novo Cliente</span>
              </button>
            </div>

            {clientes.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-400">
                  <Users className="w-7 h-7 text-emerald-400/60" />
                </div>
                <p className="text-sm font-bold text-white">Nenhum cliente cadastrado no momento</p>
                <p className="text-xs text-slate-400 max-w-md">
                  Para emitir guias, receber notas fiscais ou receber chamados via WhatsApp, cadastre sua primeira empresa cliente.
                </p>
                <button
                  onClick={() => setModalNovoClienteAberto(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold transition"
                >
                  + Cadastrar Primeira Empresa
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-6">Razão Social / Fantasia</th>
                        <th className="py-3.5 px-6">CNPJ / CPF</th>
                        <th className="py-3.5 px-6">WhatsApp</th>
                        <th className="py-3.5 px-6">Regime Tributário</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6 text-right">Cadastrado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {clientes.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-4 px-6 font-semibold text-white">
                            {c.razao_social}
                            {c.nome_fantasia && (
                              <span className="block text-[11px] font-normal text-slate-400">
                                {c.nome_fantasia}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 font-mono text-slate-300">{c.cnpj_cpf}</td>
                          <td className="py-4 px-6 font-mono text-emerald-400">{c.telefone_whatsapp}</td>
                          <td className="py-4 px-6">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {c.regime_tributario.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Ativo
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right text-slate-400 font-mono">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ABA: BASE DE CONHECIMENTO & TREINAMENTO DA IA (RAG)       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {abaAtiva === "conhecimento" && (
          <div className="space-y-6">
            {/* Header da Aba */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <span>Base de Conhecimento & Treinamento da IA</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                    RAG Multi-Tenant Ativo
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre orientações técnicas, FAQs tributários e procedimentos operacionais. O Copiloto IA consulta estas regras para formular respostas no WhatsApp e no Helpdesk.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={abrirModalNovoArtigo}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Regra / Artigo</span>
                </button>
                <button
                  onClick={() => carregarDados()}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Atualizar Base"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
                </button>
              </div>
            </div>

            {/* Layout Principal: 2 Colunas (Lista Master + Detalhes / Editor) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda: Fila de Artigos & Filtros (5 Colunas) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Barra de Busca e Filtros por Departamento */}
                <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por título, conteúdo ou tags..."
                      value={buscaArtigo}
                      onChange={(e) => setBuscaArtigo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  {/* Chips de Departamento */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium custom-scrollbar">
                    {["TODOS", "FISCAL", "CONTABIL", "FOLHA", "SOCIETARIO", "GERAL"].map((dept) => (
                      <button
                        key={dept}
                        onClick={() => setFiltroDeptArtigo(dept)}
                        className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                          filtroDeptArtigo === dept
                            ? "bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30"
                            : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de Artigos */}
                <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
                  {artigosFiltrados.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 text-center space-y-3">
                      <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-white">Nenhum artigo encontrado</p>
                      <p className="text-[11px] text-slate-400">
                        {artigos.length === 0
                          ? "Cadastre o primeiro artigo para que a IA aprenda os procedimentos do seu escritório."
                          : "Nenhum resultado para os filtros selecionados."}
                      </p>
                      {artigos.length === 0 && (
                        <button
                          onClick={abrirModalNovoArtigo}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          + Cadastrar Primeiro Artigo
                        </button>
                      )}
                    </div>
                  ) : (
                    artigosFiltrados.map((art) => {
                      const isSelected = artigoSelecionado?.id === art.id;
                      return (
                        <div
                          key={art.id}
                          onClick={() => setArtigoSelecionado(art)}
                          className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                            isSelected
                              ? "bg-purple-950/20 border-purple-500/40 shadow-lg shadow-purple-500/5"
                              : "bg-slate-900/80 border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-white line-clamp-1">
                              {art.titulo}
                            </h3>
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase shrink-0 ${
                                art.departamento === "fiscal"
                                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                                  : art.departamento === "folha"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : art.departamento === "contabil"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : art.departamento === "societario"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                              }`}
                            >
                              {art.departamento}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {art.conteudo}
                          </p>

                          {art.tags && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {art.tags.split(",").map((t, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono border border-slate-800"
                                >
                                  #{t.trim()}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/40">
                            <span>Autor: {art.criado_por || "Admin"}</span>
                            <span>{new Date(art.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna Direita: Visualizador do Artigo & Modelos (7 Colunas) */}
              <div className="lg:col-span-7">
                {artigoSelecionado ? (
                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-5 shadow-xl">
                    {/* Header do Artigo Selecionado */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              artigoSelecionado.departamento === "fiscal"
                                ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                                : artigoSelecionado.departamento === "folha"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : artigoSelecionado.departamento === "contabil"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : artigoSelecionado.departamento === "societario"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            }`}
                          >
                            {artigoSelecionado.departamento}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ● {artigoSelecionado.status.toUpperCase()}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-white leading-tight">
                          {artigoSelecionado.titulo}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => abrirModalEditarArtigo(artigoSelecionado)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleExcluirArtigo(artigoSelecionado.id, artigoSelecionado.titulo)}
                          disabled={excluindoArtigoId === artigoSelecionado.id}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition cursor-pointer"
                          title="Excluir Artigo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Badge de Funcionamento RAG */}
                    <div className="p-3.5 bg-gradient-to-r from-purple-950/30 via-slate-950 to-indigo-950/30 border border-purple-500/20 rounded-2xl flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-purple-300">Como a IA utiliza este artigo:</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Quando um cliente faz uma pergunta relacionada aos termos cadastrados nas tags ou título, o motor de RAG injeta este texto como instrução prioritária no prompt do modelo.
                        </p>
                      </div>
                    </div>

                    {/* Conteúdo Completo do Artigo */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Instrução / Procedimento Cadastrado
                      </label>
                      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {artigoSelecionado.conteudo}
                      </div>
                    </div>

                    {/* Tags Associadas */}
                    {artigoSelecionado.tags && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-purple-400" />
                          <span>Tags & Termos-Chave para Busca RAG</span>
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {artigoSelecionado.tags.split(",").map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono"
                            >
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadados Técnicos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Criado por</span>
                        <span className="font-semibold text-white">{artigoSelecionado.criado_por || "Admin"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Data de Criação</span>
                        <span className="font-mono text-slate-300">
                          {new Date(artigoSelecionado.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Tenant ID</span>
                        <span className="font-mono text-[10px] text-emerald-400 truncate block">
                          {artigoSelecionado.tenant_id}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-8 text-center space-y-6 shadow-xl">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                        <Lightbulb className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Modelos Prontos de Treinamento RAG</h3>
                      <p className="text-xs text-slate-400">
                        Clique em um dos modelos abaixo para cadastrar rapidamente regras frequentes do escritório na IA:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                      <div
                        onClick={() =>
                          aplicarTemplateArtigo(
                            "Prazo para Envio de Extratos Bancários e Notas Fiscais",
                            "fiscal",
                            "extrato, ofx, nota fiscal, prazo, fechamento",
                            "Os extratos bancários em formato OFX e notas fiscais de serviços/comércio devem ser enviados até o 5º dia útil de cada mês para garantir o fechamento fiscal dentro do prazo sem multas."
                          )
                        }
                        className="p-4 bg-slate-950 border border-slate-800 hover:border-purple-500/40 rounded-2xl transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-teal-400 uppercase">Fiscal</span>
                          <Plus className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <h4 className="text-xs font-bold text-white">Prazo de Extratos & Notas</h4>
                        <p className="text-[11px] text-slate-400">Instruções de fechamento até o 5º dia útil.</p>
                      </div>

                      <div
                        onClick={() =>
                          aplicarTemplateArtigo(
                            "Procedimento e Documentos para Admissão de Funcionário",
                            "folha",
                            "admissao, funcionario, contratação, ctps, exame admissional",
                            "Para admissão de novo colaborador, o cliente deve enviar com no mínimo 48h úteis de antecedência: RG, CPF, comprovante de endereço, foto, dados da CTPS Digital e o Exame Admissional (ASO)."
                          )
                        }
                        className="p-4 bg-slate-950 border border-slate-800 hover:border-purple-500/40 rounded-2xl transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">Folha / DP</span>
                          <Plus className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <h4 className="text-xs font-bold text-white">Admissão de Colaboradores</h4>
                        <p className="text-[11px] text-slate-400">Checklist de documentos com 48h de antecedência.</p>
                      </div>

                      <div
                        onClick={() =>
                          aplicarTemplateArtigo(
                            "Vencimento e Parcelamento da Guia DAS Simples Nacional",
                            "fiscal",
                            "das, simples nacional, parcelamento, vencimento, dia 20",
                            "A guia DAS vence todo dia 20 do mês subsequente. Caso o dia 20 caia em fim de semana ou feriado, o vencimento é prorrogado para o primeiro dia útil seguinte. Guias em atraso podem ser recalculadas ou parceladas no portal e-CAC."
                          )
                        }
                        className="p-4 bg-slate-950 border border-slate-800 hover:border-purple-500/40 rounded-2xl transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-teal-400 uppercase">Fiscal</span>
                          <Plus className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <h4 className="text-xs font-bold text-white">Vencimento & Parcelamento do DAS</h4>
                        <p className="text-[11px] text-slate-400">Regras de prorrogação e parcelamento e-CAC.</p>
                      </div>

                      <div
                        onClick={() =>
                          aplicarTemplateArtigo(
                            "Emissão de Certidões Negativas de Débitos (CND)",
                            "geral",
                            "cnd, certidao negativa, receita federal, fgts, tributos",
                            "Emitimos CNDs da Receita Federal, FGTS e Trabalhista sob demanda pelo Portal do Cliente ou WhatsApp. O prazo de emissão é de até 24h úteis desde que a empresa não possua pendências fiscais em aberto."
                          )
                        }
                        className="p-4 bg-slate-950 border border-slate-800 hover:border-purple-500/40 rounded-2xl transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-purple-400 uppercase">Geral</span>
                          <Plus className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <h4 className="text-xs font-bold text-white">Emissão de Certidões (CND)</h4>
                        <p className="text-[11px] text-slate-400">Prazo de 24h e orientações para certidões.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ABA: WHATSAPP BRIDGE (BAILEYS / CONEXÃO) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {abaAtiva === "whatsapp" && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-400" />
                  <span>WhatsApp Bridge & Integração Baileys</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Gerencie a conexão do WhatsApp do seu escritório para atendimento com IA e recepção de notas fiscais.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                  Webhook Ativo na Porta 8000
                </span>
              </div>
            </div>

            {/* Card de Pareamento / QR Code Dinâmico em Tempo Real */}
            {whatsappStatus.isConnected ? (
              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl shrink-0">
                    ✅
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>WhatsApp Conectado em Tempo Real</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">ONLINE</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Instância pareada com o número físico: <strong className="text-emerald-400 font-mono">+{whatsappStatus.userPhone}</strong>
                    </p>
                  </div>
                </div>
                <a
                  href="http://localhost:8085/session/reset"
                  target="_blank"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 text-xs font-semibold text-slate-300 transition shrink-0"
                >
                  Desconectar / Trocar Aparelho
                </a>
              </div>
            ) : (
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Aguardando Leitura do QR Code
                  </div>
                  <h3 className="text-base font-bold text-white">Escaneie o QR Code com o WhatsApp do seu Celular</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    1. Abra o WhatsApp no seu celular físico<br />
                    2. Toque em <strong>Configurações / Aparelhos Conectados</strong><br />
                    3. Toque em <strong>Conectar um aparelho</strong> e aponte para o QR Code ao lado
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                    <a
                      href="http://localhost:8085"
                      target="_blank"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir QR Code em Tela Cheia (http://localhost:8085)</span>
                    </a>
                  </div>
                </div>

                {whatsappStatus.qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl shrink-0">
                    <img src={whatsappStatus.qrDataUrl} width="200" height="200" alt="QR Code WhatsApp" className="rounded-xl" />
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center p-4 text-center shrink-0 space-y-2">
                    <QrCode className="w-10 h-10 text-slate-500 animate-pulse" />
                    <span className="text-xs text-slate-400 font-medium">Iniciando Bridge...</span>
                    <a href="http://localhost:8085" target="_blank" className="text-[11px] text-emerald-400 underline">
                      Abrir http://localhost:8085
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Informações de Conexão */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <QrCode className="w-5 h-5 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">Configuração da Instância do WhatsApp</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Endpoint de Webhook Oficial
                    </label>
                    <div className="mt-1 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-emerald-400 select-all">
                      http://localhost:8000/api/v1/webhooks/whatsapp
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">
                        Header de Autenticação (Chave Secreta)
                      </label>
                      <span className="text-[10px] text-amber-400 font-medium">
                        {user.role === "ADMIN_ESCRITORIO" ? "Acesso Restrito Admin" : "Apenas Leitura"}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex-1 font-mono text-xs text-slate-300 px-2 truncate">
                        apikey:{" "}
                        {user.role === "ADMIN_ESCRITORIO" && mostrarChaveWebhook ? (
                          <span className="text-amber-300 font-bold">webhook_secret_seguro_2026</span>
                        ) : (
                          <span className="text-slate-500 tracking-widest font-extrabold">
                            ••••••••••••••••••••••••••••••••
                          </span>
                        )}
                      </div>

                      {user.role === "ADMIN_ESCRITORIO" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMostrarChaveWebhook(!mostrarChaveWebhook)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title={mostrarChaveWebhook ? "Ocultar Chave" : "Revelar Chave"}
                          >
                            {mostrarChaveWebhook ? (
                              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText("webhook_secret_seguro_2026");
                              setChaveWebhookCopiada(true);
                              setNotificacao("Chave de autenticação do Webhook copiada com segurança!");
                              setTimeout(() => {
                                setChaveWebhookCopiada(false);
                                setNotificacao(null);
                              }, 3000);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Copiar Chave"
                          >
                            {chaveWebhookCopiada ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      ⚠️ Esta chave valida que as requisições HTTP provêm exclusivamente da instância oficial do WhatsApp Bridge.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Telefone Cadastrado do Escritório
                    </label>
                    <div className="mt-1 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-slate-300">
                      {escritorio?.telefone || "(Não configurado)"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Como Funciona o Webhook Inteligente */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Roteamento Inteligente em 2 Etapas</h3>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
                    <p className="font-semibold text-emerald-400">1. Arquivos de Mídia (XML / PDF / Imagem)</p>
                    <p className="text-[11px] text-slate-400">
                      Quando o cliente envia uma NF-e ou comprovante pelo WhatsApp, o sistema cataloga imediatamente na tabela de Documentos Fiscais para conferência contábil.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
                    <p className="font-semibold text-teal-400">2. Mensagens de Texto (Dúvidas)</p>
                    <p className="text-[11px] text-slate-400">
                      Cria uma solicitação no Helpdesk e aciona o Copiloto de IA para gerar um rascunho. O contador revisa e aprova antes de disparar a resposta de volta ao WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ABA 4: DADOS DO ESCRITÓRIO (TENANT / CONFIGURAÇÕES) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {abaAtiva === "escritorio" && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <span>Dados Cadastrais do Escritório Contábil</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Consulte os parâmetros organizacionais do seu Tenant e dados corporativos registrados no banco.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Plano: {escritorio?.plano || "ALL_IN_ONE_PRO"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Identificação Institucional */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs uppercase font-bold text-emerald-400 tracking-wider border-b border-slate-800 pb-2">
                  1. Organização & Identificação
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Razão Social / Nome do Escritório
                    </label>
                    <p className="text-sm font-bold text-white mt-0.5">{escritorio?.nome || "Carregando..."}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">CNPJ</label>
                      <p className="text-xs font-mono font-medium text-slate-200 mt-0.5">
                        {escritorio?.cnpj || "—"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">WhatsApp Oficial</label>
                      <p className="text-xs font-mono font-medium text-slate-200 mt-0.5">
                        {escritorio?.telefone || "—"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      E-mail Corporativo
                    </label>
                    <p className="text-xs text-slate-200 mt-0.5">{escritorio?.email || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Tenant & Segurança Multi-Tenant */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs uppercase font-bold text-teal-400 tracking-wider border-b border-slate-800 pb-2">
                  2. Parâmetros Multi-Tenant
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Tenant ID Oficial (Chave de Isolamento)
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        readOnly
                        value={user.tenant_id}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 rounded-xl p-2.5 outline-none"
                      />
                      <button
                        onClick={copiarTenantId}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                        title="Copiar Tenant ID"
                      >
                        {tenantCopiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Clientes</span>
                      <span className="text-xl font-bold text-white mt-1 block">{clientes.length}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contadores/Usuários</span>
                      <span className="text-xl font-bold text-white mt-1 block">{escritorio?.total_usuarios || 1}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Todas as consultas SQL são filtradas rigidamente por este Tenant ID.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ABA 3: DOCUMENTOS & OCR (VISUALIZADOR TRIPARTITE DE AUDITORIA) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {abaAtiva === "documentos" && (
          <div className="space-y-4">
            {/* Header da Aba com Ações Rápidas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Fila de Auditoria Fiscal & OCR
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Zero-Paper
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extração automática de XML NF-e/NFC-e, Extratos OFX e Comprovantes recebidos via WhatsApp e Portal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalUploadDocAberto(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Novo Upload Manual</span>
                </button>
                <button
                  onClick={() => carregarDados()}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Atualizar Fila"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-teal-400" : ""}`} />
                </button>
              </div>
            </div>

            {/* Grid Tripartite: Coluna 1 (Fila) | Coluna 2 (Visualizador) | Coluna 3 (Decisão/OCR) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[720px]">
              {/* ────────────────────────────────────────────────────────── */}
              {/* COLUNA 1: FILA DE ARQUIVOS (3 COLUNAS GRID)                */}
              {/* ────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 space-y-3 flex flex-col h-[740px] shadow-xl">
                {/* Busca e Contadores */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                      Fila de Entrada
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {documentosFiltrados.length} / {documentos.length}
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por arquivo, chave, CNPJ..."
                      value={buscaDoc}
                      onChange={(e) => setBuscaDoc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-3 py-2 rounded-xl outline-none focus:border-teal-500 transition"
                    />
                  </div>
                </div>

                {/* Filtros de Status (Pílulas) */}
                <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-medium border-b border-slate-800 pb-2">
                  {(["TODOS", "PENDENTE", "PROCESSADO", "REJEITADO"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFiltroStatusDoc(st)}
                      className={`px-2 py-1 rounded-lg shrink-0 transition cursor-pointer ${
                        filtroStatusDoc === st
                          ? "bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30"
                          : "text-slate-400 hover:text-white bg-slate-950/60"
                      }`}
                    >
                      {st === "TODOS"
                        ? "Todos"
                        : st === "PENDENTE"
                        ? "Pendentes"
                        : st === "PROCESSADO"
                        ? "Aprovados"
                        : "Rejeitados"}
                    </button>
                  ))}
                </div>

                {/* Filtros de Tipo */}
                <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-medium">
                  {["TODOS", "NFE", "NFCE", "EXTRATO", "RECIBO"].map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setFiltroTipoDoc(tp)}
                      className={`px-2 py-0.5 rounded-lg shrink-0 transition cursor-pointer ${
                        filtroTipoDoc === tp
                          ? "bg-slate-700 text-white font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>

                {/* Lista Scrollável de Documentos */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {documentosFiltrados.length === 0 ? (
                    <div className="text-center py-12 px-3">
                      <FileX className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                      <p className="text-xs text-slate-400 font-medium">Nenhum documento encontrado.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Altere os filtros ou envie um novo arquivo.</p>
                    </div>
                  ) : (
                    documentosFiltrados.map((doc) => {
                      const isSelecionado = documentoSelecionado?.id === doc.id;
                      const clienteVinculado = clientes.find((c) => c.id === doc.cliente_id);
                      const confianca = doc.score_confianca || 92;

                      return (
                        <div
                          key={doc.id}
                          onClick={() => selecionarDocumento(doc)}
                          className={`p-3 rounded-2xl border transition cursor-pointer text-left space-y-2 ${
                            isSelecionado
                              ? "bg-slate-800/90 border-teal-500 shadow-md shadow-teal-500/10"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  doc.file_extension.toLowerCase() === ".xml"
                                    ? "bg-orange-500/10 text-orange-400"
                                    : doc.file_extension.toLowerCase() === ".ofx"
                                    ? "bg-sky-500/10 text-sky-400"
                                    : doc.file_extension.toLowerCase() === ".pdf"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}
                              >
                                {doc.file_extension.toLowerCase() === ".xml" ||
                                doc.file_extension.toLowerCase() === ".ofx" ? (
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                ) : doc.file_extension.toLowerCase() === ".pdf" ? (
                                  <FileText className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{doc.titulo}</p>
                                <p className="text-[10px] text-slate-400 truncate">{doc.file_name}</p>
                              </div>
                            </div>

                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase ${
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
                                ? "Rejeitado"
                                : "Pendente"}
                            </span>
                          </div>

                          {/* Detalhes Rápidos: Empresa + Valor + Score */}
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                            <span className="text-slate-400 truncate max-w-[110px]">
                              {clienteVinculado ? clienteVinculado.razao_social : doc.enviado_por}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc.valor_total && doc.valor_total > 0 ? (
                                <span className="font-mono font-bold text-emerald-400">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(doc.valor_total)}
                                </span>
                              ) : null}
                              <span
                                className={`inline-flex items-center gap-0.5 text-[9px] font-mono px-1 rounded ${
                                  confianca >= 90
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : confianca >= 70
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                {confianca}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ────────────────────────────────────────────────────────── */}
              {/* COLUNA 2: VISUALIZADOR CENTRAL DE MÍDIA & DANFE            */}
              {/* ────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 space-y-3 flex flex-col h-[740px] shadow-xl overflow-hidden">
                {documentoSelecionado ? (
                  <>
                    {/* Barra de Ferramentas Superior do Visualizador */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-teal-400 font-bold">
                          {documentoSelecionado.file_extension.replace(".", "") || "DOC"}
                        </span>
                        <h3 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                          {documentoSelecionado.titulo}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          ({(documentoSelecionado.file_size / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      {/* Alternador de Visualização para XML */}
                      {documentoSelecionado.file_extension.toLowerCase() === ".xml" && (
                        <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[10px]">
                          <button
                            onClick={() => setAbaPreviewXml("danfe")}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                              abaPreviewXml === "danfe"
                                ? "bg-teal-500/20 text-teal-300 font-bold"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            DANFE SEFAZ
                          </button>
                          <button
                            onClick={() => setAbaPreviewXml("codigo")}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                              abaPreviewXml === "codigo"
                                ? "bg-teal-500/20 text-teal-300 font-bold"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            XML Bruto
                          </button>
                        </div>
                      )}

                      {/* Controles de Zoom, Rotação e Download */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setZoomNivel((z) => Math.max(z - 15, 50))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Reduzir Zoom"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-400 px-1">{zoomNivel}%</span>
                        <button
                          onClick={() => setZoomNivel((z) => Math.min(z + 15, 200))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Aumentar Zoom"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRotacao((r) => (r + 90) % 360)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Girar 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`http://localhost:8000/api/v1/documentos/${documentoSelecionado.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition cursor-pointer border border-teal-500/20"
                          title="Download Original"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Canvas de Renderização Central */}
                    <div className="flex-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 overflow-auto relative flex flex-col p-3 custom-scrollbar">
                      {/* 1. SE FOR PDF */}
                      {documentoSelecionado.file_extension.toLowerCase() === ".pdf" ? (
                        <iframe
                          src={`http://localhost:8000/api/v1/documentos/${documentoSelecionado.id}/visualizar#toolbar=0`}
                          className="w-full h-full min-h-[500px] rounded-xl border border-slate-800/60 bg-slate-900"
                          title="Visualizador PDF"
                        />
                      ) : /* 2. SE FOR IMAGEM */
                      [".png", ".jpg", ".jpeg", ".webp"].includes(
                          documentoSelecionado.file_extension.toLowerCase()
                        ) ? (
                        <div className="flex-1 flex items-center justify-center overflow-auto p-4">
                          <img
                            src={`http://localhost:8000/api/v1/documentos/${documentoSelecionado.id}/visualizar`}
                            alt={documentoSelecionado.titulo}
                            style={{
                              transform: `scale(${zoomNivel / 100}) rotate(${rotacao}deg)`,
                              transition: "transform 0.15s ease-out",
                            }}
                            className="max-h-[600px] object-contain rounded-xl shadow-2xl border border-slate-800"
                          />
                        </div>
                      ) : /* 3. SE FOR XML */
                      documentoSelecionado.file_extension.toLowerCase() === ".xml" ? (
                        abaPreviewXml === "danfe" ? (
                          /* Visualizador DANFE SEFAZ Simplificada */
                          <div className="space-y-4 text-xs">
                            {/* Topo DANFE */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div>
                                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                                    DANFE Simplificada
                                  </span>
                                  <h4 className="text-sm font-extrabold text-white">
                                    Documento Auxiliar da Nota Fiscal Eletrônica
                                  </h4>
                                </div>
                                <span className="px-2 py-1 rounded bg-teal-500/10 border border-teal-500/20 text-teal-300 font-mono text-[10px]">
                                  {dadosOcr?.natureza_operacao || "VENDA MERCADORIA"}
                                </span>
                              </div>

                              {/* Chave de Acesso SEFAZ de 44 dígitos */}
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  Chave de Acesso (44 Dígitos SEFAZ)
                                </label>
                                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                                  <code className="text-xs font-mono text-emerald-400 font-bold tracking-wider flex-1 truncate">
                                    {documentoSelecionado.chave_acesso ||
                                      dadosOcr?.chave_acesso ||
                                      "Nenhuma chave extraída"}
                                  </code>
                                  {(documentoSelecionado.chave_acesso || dadosOcr?.chave_acesso) && (
                                    <button
                                      onClick={() => {
                                        const chave =
                                          documentoSelecionado.chave_acesso || dadosOcr?.chave_acesso;
                                        if (chave) navigator.clipboard.writeText(chave);
                                        setNotificacao("Chave de 44 dígitos copiada!");
                                        setTimeout(() => setNotificacao(null), 3000);
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                      title="Copiar Chave"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Emitente & Destinatário */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                    Emitente
                                  </span>
                                  <p className="text-xs font-semibold text-white mt-0.5">
                                    {dadosOcr?.emitente?.nome || "Razão Social do Emitente"}
                                  </p>
                                  <p className="text-[11px] font-mono text-slate-400">
                                    CNPJ: {dadosOcr?.emitente?.cnpj || documentoSelecionado.cnpj_emitente || "—"}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {dadosOcr?.emitente?.municipio || ""} {dadosOcr?.emitente?.uf ? `- ${dadosOcr.emitente.uf}` : ""}
                                  </p>
                                </div>

                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                    Destinatário
                                  </span>
                                  <p className="text-xs font-semibold text-white mt-0.5">
                                    {dadosOcr?.destinatario?.nome || "Cliente Destinatário"}
                                  </p>
                                  <p className="text-[11px] font-mono text-slate-400">
                                    CNPJ/CPF: {dadosOcr?.destinatario?.cnpj || "—"}
                                  </p>
                                </div>
                              </div>

                              {/* Resumo de Tributos & Totais */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                <div className="p-2.5 bg-slate-950 rounded-xl border border-emerald-500/30">
                                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                                    Total da Nota
                                  </span>
                                  <p className="text-sm font-extrabold text-emerald-300 font-mono mt-0.5">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(
                                      dadosOcr?.totais?.valor_total_nota ||
                                        documentoSelecionado.valor_total ||
                                        0
                                    )}
                                  </p>
                                </div>

                                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                    Base ICMS
                                  </span>
                                  <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(dadosOcr?.totais?.base_icms || 0)}
                                  </p>
                                </div>

                                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                    Valor ICMS
                                  </span>
                                  <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(dadosOcr?.totais?.valor_icms || 0)}
                                  </p>
                                </div>

                                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                    PIS / COFINS
                                  </span>
                                  <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(
                                      (dadosOcr?.totais?.valor_pis || 0) +
                                        (dadosOcr?.totais?.valor_cofins || 0)
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Tabela de Produtos / Itens da NF-e */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                  Itens / Mercadorias ({dadosOcr?.itens?.length || 0})
                                </span>
                              </div>

                              {dadosOcr?.itens && dadosOcr.itens.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="py-1.5 px-2">#</th>
                                        <th className="py-1.5 px-2">Descrição</th>
                                        <th className="py-1.5 px-2 font-mono">NCM</th>
                                        <th className="py-1.5 px-2 font-mono">CFOP</th>
                                        <th className="py-1.5 px-2 text-right">Qtd</th>
                                        <th className="py-1.5 px-2 text-right">Vl. Unit</th>
                                        <th className="py-1.5 px-2 text-right">Vl. Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {dadosOcr.itens.map((it: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-800/40">
                                          <td className="py-1.5 px-2 text-slate-400 font-mono">{it.item || idx + 1}</td>
                                          <td className="py-1.5 px-2 text-white font-medium">{it.descricao}</td>
                                          <td className="py-1.5 px-2 font-mono text-slate-300">{it.ncm || "—"}</td>
                                          <td className="py-1.5 px-2 font-mono text-slate-300">{it.cfop || "—"}</td>
                                          <td className="py-1.5 px-2 text-right font-mono text-slate-200">
                                            {it.quantidade}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono text-slate-300">
                                            {new Intl.NumberFormat("pt-BR", {
                                              style: "currency",
                                              currency: "BRL",
                                            }).format(it.valor_unitario || 0)}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-400">
                                            {new Intl.NumberFormat("pt-BR", {
                                              style: "currency",
                                              currency: "BRL",
                                            }).format(it.valor_total || 0)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 py-3 text-center">
                                  Nenhum item discriminado no extrato resumido.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Visualizador Código Fonte XML Bruto */
                          <div className="relative">
                            <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {carregandoTexto
                                ? "Carregando XML do servidor..."
                                : conteudoTextoDoc || "Conteúdo não disponível."}
                            </pre>
                          </div>
                        )
                      ) : /* 4. SE FOR EXTRATO OFX OU TXT */
                      documentoSelecionado.file_extension.toLowerCase() === ".ofx" ? (
                        <div className="space-y-3 text-xs">
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                                Extrato Bancário OFX
                              </span>
                              <span className="text-xs font-mono text-slate-300">
                                Banco: {dadosOcr?.codigo_banco || "033"} | Conta: {dadosOcr?.conta || "—"}
                              </span>
                            </div>

                            {dadosOcr?.transacoes && dadosOcr.transacoes.length > 0 ? (
                              <div className="divide-y divide-slate-800/60">
                                {dadosOcr.transacoes.map((tr: any, idx: number) => (
                                  <div key={idx} className="py-2 flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-semibold text-white">{tr.descricao}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">{tr.data}</p>
                                    </div>
                                    <span
                                      className={`font-mono font-bold text-xs ${
                                        tr.tipo === "CREDIT" ? "text-emerald-400" : "text-rose-400"
                                      }`}
                                    >
                                      {tr.tipo === "CREDIT" ? "+" : "-"}
                                      {new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      }).format(Math.abs(tr.valor || 0))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                                {conteudoTextoDoc || "Carregando OFX..."}
                              </pre>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Arquivo Genérico / Texto */
                        <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                          {conteudoTextoDoc || "Arquivo recebido. Clique no botão de download para abri-lo."}
                        </pre>
                      )}
                    </div>
                  </>
                ) : (
                  /* Empty State Central */
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-inner">
                      <FileText className="w-8 h-8 opacity-60" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Nenhum Documento Selecionado</h3>
                    <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                      Selecione qualquer nota fiscal, extrato bancário ou comprovante na fila ao lado para auditar e
                      conferir metadados extraídos por OCR.
                    </p>
                  </div>
                )}
              </div>

              {/* ────────────────────────────────────────────────────────── */}
              {/* COLUNA 3: PAINEL DE AUDITORIA & DECISÃO CONTÁBIL           */}
              {/* ────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 space-y-4 flex flex-col h-[740px] shadow-xl overflow-y-auto custom-scrollbar">
                {documentoSelecionado ? (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                          <CheckCheck className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                          Auditoria & Ações
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          documentoSelecionado.status === "PROCESSADO"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : documentoSelecionado.status === "REJEITADO"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {documentoSelecionado.status}
                      </span>
                    </div>

                    {/* Alerta de Rejeição (se houver) */}
                    {documentoSelecionado.status === "REJEITADO" && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Motivo da Inconsistência:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {documentoSelecionado.motivo_rejeicao || "Inconsistência não detalhada."}
                        </p>
                      </div>
                    )}

                    {/* Card de Inteligência de Extração / Score */}
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Motor de Leitura</span>
                        <span className="text-[10px] font-mono text-teal-300 font-semibold">
                          {documentoSelecionado.file_extension.toLowerCase() === ".xml"
                            ? "Parser SEFAZ Nativo"
                            : documentoSelecionado.file_extension.toLowerCase() === ".ofx"
                            ? "Extrator Bancário OFX"
                            : "Gemini Vision OCR"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Confiança da Extração:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {documentoSelecionado.score_confianca || 94}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                            style={{ width: `${documentoSelecionado.score_confianca || 94}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Metadados Fiscais para Validação Rápida */}
                    <div className="space-y-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Conferência Contábil
                      </span>

                      <div className="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase block">Empresa Cliente</label>
                          <p className="text-xs font-semibold text-white truncate">
                            {clientes.find((c) => c.id === documentoSelecionado.cliente_id)?.razao_social ||
                              documentoSelecionado.enviado_por}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase block">Tipo Fiscal</label>
                            <span className="text-xs font-bold text-teal-400">{documentoSelecionado.tipo}</span>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase block">Competência</label>
                            <span className="text-xs font-mono text-slate-200">
                              {documentoSelecionado.competencia}
                            </span>
                          </div>
                        </div>

                        {documentoSelecionado.cnpj_emitente && (
                          <div className="pt-1 border-t border-slate-800/60">
                            <label className="text-[10px] text-slate-500 uppercase block">CNPJ Emitente</label>
                            <span className="text-xs font-mono text-slate-300">
                              {documentoSelecionado.cnpj_emitente}
                            </span>
                          </div>
                        )}

                        <div className="pt-1 border-t border-slate-800/60">
                          <label className="text-[10px] text-slate-500 uppercase block">Valor Total Extraído</label>
                          <span className="text-base font-extrabold font-mono text-emerald-400">
                            {documentoSelecionado.valor_total
                              ? new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(documentoSelecionado.valor_total)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação Decisória */}
                    <div className="space-y-2 pt-2 mt-auto">
                      {documentoSelecionado.status !== "PROCESSADO" && (
                        <button
                          onClick={() => aprovarDocumento(documentoSelecionado.id)}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Validar e Lançar Documento</span>
                        </button>
                      )}

                      {documentoSelecionado.status !== "REJEITADO" && (
                        <button
                          onClick={() => {
                            setMotivoRejeicao("");
                            setModalRejeicaoAberto(true);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <FileX className="w-4 h-4 text-rose-400" />
                          <span>Rejeitar (Apontar Inconsistência)</span>
                        </button>
                      )}

                      <button
                        onClick={() => reprocessarOcrDocumento(documentoSelecionado.id)}
                        className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                        <span>Reprocessar com IA / OCR</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-6 text-slate-500 text-xs">
                    Selecione um documento para auditar.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CADASTRAR NOVO CLIENTE */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {modalNovoClienteAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Cadastrar Nova Empresa Cliente</h3>
              </div>
              <button
                onClick={() => setModalNovoClienteAberto(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCadastrarCliente} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Razão Social da Empresa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Padaria Estrela do Sul Ltda"
                  value={formCliente.razao_social}
                  onChange={(e) => setFormCliente({ ...formCliente, razao_social: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Padaria Estrela"
                    value={formCliente.nome_fantasia}
                    onChange={(e) => setFormCliente({ ...formCliente, nome_fantasia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    CNPJ ou CPF *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0001-00"
                    value={formCliente.cnpj_cpf}
                    onChange={(e) => setFormCliente({ ...formCliente, cnpj_cpf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    E-mail de Contato *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contato@empresa.com.br"
                    value={formCliente.email}
                    onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    WhatsApp (E.164) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="5511999998888"
                    value={formCliente.telefone_whatsapp}
                    onChange={(e) => setFormCliente({ ...formCliente, telefone_whatsapp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Regime Tributário
                </label>
                <select
                  value={formCliente.regime_tributario}
                  onChange={(e) => setFormCliente({ ...formCliente, regime_tributario: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-emerald-500"
                >
                  <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                  <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                  <option value="LUCRO_REAL">Lucro Real</option>
                  <option value="MEI">MEI (Microempreendedor Individual)</option>
                </select>
              </div>

              {/* Acesso ao Portal do Cliente */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCliente.criar_usuario_acesso}
                    onChange={(e) => setFormCliente({ ...formCliente, criar_usuario_acesso: e.target.checked })}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Criar login para o cliente acessar o Portal do Cliente
                  </span>
                </label>

                {formCliente.criar_usuario_acesso && (
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                      Senha de Acesso do Cliente
                    </label>
                    <input
                      type="password"
                      required={formCliente.criar_usuario_acesso}
                      placeholder="••••••••"
                      value={formCliente.usuario_senha}
                      onChange={(e) => setFormCliente({ ...formCliente, usuario_senha: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2 outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoClienteAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoCliente}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {salvandoCliente ? "Salvando..." : "Salvar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL 2: ABRIR NOVO CHAMADO (HELPDESK) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {modalNovoChamadoAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Abrir Novo Chamado de Atendimento</h3>
              </div>
              <button
                onClick={() => setModalNovoChamadoAberto(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCriarChamado} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Empresa Cliente Vinculada
                </label>
                {clientes.length > 0 ? (
                  <select
                    value={formChamado.cliente_id}
                    onChange={(e) => setFormChamado({ ...formChamado, cliente_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="">(Selecione uma empresa cadastrada)</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Nome do cliente ou solicitante"
                      value={formChamado.cliente_nome}
                      onChange={(e) => setFormChamado({ ...formChamado, cliente_nome: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Nenhum cliente cadastrado ainda. O chamado será registrado avulso.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Assunto do Chamado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dúvida sobre emissão de nota fiscal de serviço"
                  value={formChamado.assunto}
                  onChange={(e) => setFormChamado({ ...formChamado, assunto: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Departamento
                  </label>
                  <select
                    value={formChamado.departamento}
                    onChange={(e) => setFormChamado({ ...formChamado, departamento: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="FISCAL">Fiscal</option>
                    <option value="CONTABIL">Contábil</option>
                    <option value="PESSOAL">Pessoal / RH</option>
                    <option value="JURIDICO">Jurídico</option>
                    <option value="GERAL">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Prioridade
                  </label>
                  <select
                    value={formChamado.prioridade}
                    onChange={(e) => setFormChamado({ ...formChamado, prioridade: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Descrição da Solicitação / Mensagem do Cliente *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Descreva a dúvida técnica ou mensagem enviada pelo cliente..."
                  value={formChamado.descricao}
                  onChange={(e) => setFormChamado({ ...formChamado, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoChamadoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoChamado}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {salvandoChamado ? "Abrindo Chamado..." : "Abrir Chamado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL 3: EMITIR NOVA GUIA FISCAL */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {modalNovaGuiaAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Emitir Nova Guia Fiscal & Cobrança</h3>
              </div>
              <button
                onClick={() => setModalNovaGuiaAberto(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEmitirGuia} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Empresa Destinatária *
                </label>
                {clientes.length > 0 ? (
                  <select
                    required
                    value={formGuia.cliente_id}
                    onChange={(e) => setFormGuia({ ...formGuia, cliente_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="">Selecione o cliente cadastrado...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razao_social} ({c.cnpj_cpf})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                    <span>Você precisa cadastrar um cliente antes de emitir guias.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalNovaGuiaAberto(false);
                        setModalNovoClienteAberto(true);
                      }}
                      className="underline font-semibold cursor-pointer"
                    >
                      Cadastrar Agora
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Tipo de Guia *
                  </label>
                  <select
                    value={formGuia.tipo_guia}
                    onChange={(e) => setFormGuia({ ...formGuia, tipo_guia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="DAS">DAS (Simples Nacional)</option>
                    <option value="DARF">DARF</option>
                    <option value="FGTS">FGTS / GRF</option>
                    <option value="ICMS">ICMS</option>
                    <option value="ISS">ISS</option>
                    <option value="GPS">GPS (INSS)</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Competência *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 03/2026"
                    value={formGuia.competencia}
                    onChange={(e) => setFormGuia({ ...formGuia, competencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Título da Guia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: DAS - Competência Março/2026"
                  value={formGuia.titulo}
                  onChange={(e) => setFormGuia({ ...formGuia, titulo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 350,00"
                    value={formGuia.valor}
                    onChange={(e) => setFormGuia({ ...formGuia, valor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formGuia.data_vencimento}
                    onChange={(e) => setFormGuia({ ...formGuia, data_vencimento: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Linha Digitável / Código de Barras
                </label>
                <input
                  type="text"
                  placeholder="85660000001-2 34560012100-3 ..."
                  value={formGuia.linha_digitavel}
                  onChange={(e) => setFormGuia({ ...formGuia, linha_digitavel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Código PIX Copia e Cola
                </label>
                <input
                  type="text"
                  placeholder="00020126580014br.gov.bcb.pix..."
                  value={formGuia.codigo_pix}
                  onChange={(e) => setFormGuia({ ...formGuia, codigo_pix: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovaGuiaAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoGuia || clientes.length === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-xs shadow-lg shadow-teal-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {salvandoGuia ? "Emitindo Guia..." : "Emitir Guia Fiscal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL 4: REJEITAR DOCUMENTO FISCAL COM MOTIVO             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {modalRejeicaoAberto && documentoSelecionado && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <FileX className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Rejeitar Documento Fiscal</h3>
                  <p className="text-[10px] text-slate-400">{documentoSelecionado.file_name}</p>
                </div>
              </div>
              <button
                onClick={() => setModalRejeicaoAberto(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={confirmarRejeicaoDocumento} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1.5">
                  Selecione um motivo frequente:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {[
                    "Documento ilegível / resolução baixa",
                    "XML fiscal corrompido / sem assinatura SEFAZ",
                    "CNPJ emitente diverge da empresa cliente",
                    "Comprovante sem autenticação bancária",
                    "Arquivo incompleto ou páginas ausentes",
                  ].map((motivo) => (
                    <button
                      key={motivo}
                      type="button"
                      onClick={() => setMotivoRejeicao(motivo)}
                      className="p-2 rounded-xl text-left bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition text-[11px] cursor-pointer"
                    >
                      {motivo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Justificativa Técnica da Rejeição *
                </label>
                <textarea
                  required
                  rows={3}
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Descreva exatamente o motivo pelo qual o documento foi rejeitado e o que o cliente precisa reenviar..."
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-3 outline-none focus:border-rose-500 transition"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-300">
                    Avisar cliente no WhatsApp sobre a inconsistência
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notificarZapRejeicao}
                  onChange={(e) => setNotificarZapRejeicao(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalRejeicaoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={rejeitandoDoc || !motivoRejeicao.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {rejeitandoDoc ? "Rejeitando..." : "Confirmar Rejeição"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL 5: UPLOAD MANUAL DE DOCUMENTO FISCAL COM OCR         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {modalUploadDocAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Upload de Documento Fiscal</h3>
                  <p className="text-[10px] text-slate-400">Processamento com OCR & Parser SEFAZ Automático</p>
                </div>
              </div>
              <button
                onClick={() => setModalUploadDocAberto(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDocumento} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Empresa Cliente Destinatária *
                </label>
                {clientes.length > 0 ? (
                  <select
                    required
                    value={formUploadDoc.cliente_id}
                    onChange={(e) => setFormUploadDoc({ ...formUploadDoc, cliente_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="">Selecione a empresa cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razao_social} ({c.cnpj_cpf})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                    Cadastre uma empresa cliente antes de fazer uploads vinculados.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Tipo de Arquivo *
                  </label>
                  <select
                    value={formUploadDoc.tipo}
                    onChange={(e) => setFormUploadDoc({ ...formUploadDoc, tipo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="NFE">NF-e (Nota Fiscal Eletrônica)</option>
                    <option value="NFCE">NFC-e (Consumidor)</option>
                    <option value="EXTRATO">Extrato Bancário (OFX / PDF)</option>
                    <option value="RECIBO">Recibo / Comprovante PIX</option>
                    <option value="OUTROS">Outros Documentos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Competência *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 03/2026"
                    value={formUploadDoc.competencia}
                    onChange={(e) => setFormUploadDoc({ ...formUploadDoc, competencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Título / Identificador
                </label>
                <input
                  type="text"
                  placeholder="Ex: NF-e Fornecedor Distribuidora X"
                  value={formUploadDoc.titulo}
                  onChange={(e) => setFormUploadDoc({ ...formUploadDoc, titulo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Arquivo Físico (XML, PDF, OFX, PNG, JPG) *
                </label>
                <input
                  type="file"
                  required
                  accept=".xml,.pdf,.ofx,.png,.jpg,.jpeg,.webp,.txt,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setArquivoUpload(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-300 hover:file:bg-teal-500/20 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalUploadDocAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoUploadDoc || !arquivoUpload || !formUploadDoc.cliente_id}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-xs shadow-lg shadow-teal-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {salvandoUploadDoc ? "Processando com OCR..." : "Enviar e Processar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL 6: CADASTRAR / EDITAR REGRA DA IA (CONHECIMENTO RAG) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {modalArtigoAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {modoEdicaoArtigo ? "Editar Regra / Artigo da IA" : "Nova Regra na Base de Conhecimento"}
                  </h3>
                  <p className="text-[10px] text-slate-400">Instruções para o Copiloto IA responder clientes no WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setModalArtigoAberto(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarArtigo} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Título da Dúvida / Orientação *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prazo para Envio de Extratos e Fechamento Mensal"
                  value={formArtigo.titulo}
                  onChange={(e) => setFormArtigo({ ...formArtigo, titulo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-purple-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Departamento *
                  </label>
                  <select
                    value={formArtigo.departamento}
                    onChange={(e) => setFormArtigo({ ...formArtigo, departamento: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-purple-500"
                  >
                    <option value="geral">Geral (Todas as dúvidas)</option>
                    <option value="fiscal">Fiscal (DAS, ICMS, Notas, Impostos)</option>
                    <option value="contabil">Contábil (Balanço, DRE, Extratos)</option>
                    <option value="folha">Folha / DP (Admissão, Férias, Rescisão, FGTS)</option>
                    <option value="societario">Societário (Abertura, Alteração, Alvará)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Status na IA *
                  </label>
                  <select
                    value={formArtigo.status}
                    onChange={(e) => setFormArtigo({ ...formArtigo, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-purple-500"
                  >
                    <option value="publicado">Publicado (Ativo no Copiloto IA)</option>
                    <option value="rascunho">Rascunho (Pausado / Em revisão)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span>Tags & Palavras-Chave (Separadas por vírgula)</span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">ajuda na busca da IA</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: simples-nacional, das, parcelamento, prazo, extrato"
                  value={formArtigo.tags}
                  onChange={(e) => setFormArtigo({ ...formArtigo, tags: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5 outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Conteúdo / Orientação Técnica Completa *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Descreva a regra exata, procedimentos, prazos ou respostas que a IA deve utilizar quando o cliente fizer perguntas sobre este tema..."
                  value={formArtigo.conteudo}
                  onChange={(e) => setFormArtigo({ ...formArtigo, conteudo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-3 outline-none focus:border-purple-500 resize-none transition leading-relaxed"
                />
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl flex items-center gap-2.5 text-xs text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Este conhecimento ficará restrito exclusivamente ao Tenant do seu escritório.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalArtigoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoArtigo || !formArtigo.titulo.trim() || !formArtigo.conteudo.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-purple-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {salvandoArtigo ? "Salvando na IA..." : modoEdicaoArtigo ? "Atualizar Artigo" : "Cadastrar na IA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Conectar WhatsApp (QR Code Live) */}
      {modalQrAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Conectar WhatsApp do Escritório</h3>
                  <p className="text-[11px] text-slate-400">Integração em tempo real com o Robô e Copiloto</p>
                </div>
              </div>
              <button
                onClick={() => setModalQrAberto(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {whatsappStatus.isConnected ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-emerald-400 text-sm">WhatsApp Conectado!</h4>
                <p className="text-xs text-slate-300 font-mono">+{whatsappStatus.userPhone}</p>
                <p className="text-[11px] text-slate-400">O sistema está apto a receber dúvidas e enviar respostas técnicas automaticamente.</p>
                <button
                  onClick={() => setModalQrAberto(false)}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Fechar e Continuar
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Abra o <b>WhatsApp</b> no celular do escritório, vá em <b>Aparelhos Conectados</b> &gt; <b>Conectar um aparelho</b> e aponte a câmera:
                </p>

                <div className="flex justify-center p-3 bg-white rounded-2xl shadow-inner mx-auto w-fit">
                  {whatsappStatus.qrDataUrl ? (
                    <img
                      src={whatsappStatus.qrDataUrl}
                      alt="QR Code WhatsApp"
                      className="w-60 h-60 rounded-xl"
                    />
                  ) : (
                    <div className="w-60 h-60 flex flex-col items-center justify-center text-slate-500 text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                      <span>Gerando QR Code...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/v1/whatsapp/status");
                        if (res.ok) {
                          const data = await res.json();
                          setWhatsappStatus(data);
                        }
                      } catch {}
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-medium transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Atualizar QR Code</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  ⚡ Conexão direta em nuvem com persistência automática de sessão.
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => setModalQrAberto(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
