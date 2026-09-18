"""
Script de Reset de Banco de Dados — Estado de Entrega Comercial (Zero-Data).
Remove bancos residuais e recria todas as tabelas 100% vazias,
garantindo que o sistema inicie sem nenhum escritório, usuário ou cliente.
"""
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

# Apaga bancos SQLite residuais dentro da pasta
for f in ["test_contabflow.db", "contabflow.db", "contabflow_all_in_one.db"]:
    caminho = os.path.join(CURRENT_DIR, f)
    if os.path.exists(caminho):
        try:
            os.remove(caminho)
            print(f"[*] Banco removido: {f}")
        except Exception as e:
            print(f"[!] Erro ao remover {f}: {e}")

from app.database.session import Base, engine, SessionLocal
import app.models  # Garante registro de todas as tabelas
from app.models.escritorio import Escritorio
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.solicitacao import Solicitacao
from app.models.tarefa import Tarefa
from app.models.imposto import Imposto
from app.models.documento import Documento
from app.models.conhecimento import ArtigoConhecimento
from app.models.rascunho_ia import RascunhoIA

print("\n[*] Criando esquema limpo de tabelas no contabflow.db...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    total_escritorios = db.query(Escritorio).count()
    total_usuarios = db.query(Usuario).count()
    total_clientes = db.query(Cliente).count()
    total_solicitacoes = db.query(Solicitacao).count()
    total_impostos = db.query(Imposto).count()

    print("[*] Verificação do Estado Zero-Data:")
    print(f"    - Escritorios: {total_escritorios}")
    print(f"    - Usuarios:    {total_usuarios}")
    print(f"    - Clientes:    {total_clientes}")
    print(f"    - Solicitacoes:{total_solicitacoes}")
    print(f"    - Impostos:    {total_impostos}")

    assert total_escritorios == 0
    assert total_usuarios == 0
    assert total_clientes == 0
    print("\n[OK] Banco de dados inicializado em estado comercial ZERO-DATA com sucesso!")
finally:
    db.close()
