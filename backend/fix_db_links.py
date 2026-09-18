import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.database.session import SessionLocal
from app.models import Solicitacao, RascunhoIA, Cliente

db = SessionLocal()
cliente = db.query(Cliente).first()
if cliente:
    print(f"Associando solicitacoes ao cliente: {cliente.razao_social} ({cliente.id})")
    for s in db.query(Solicitacao).all():
        s.cliente_id = cliente.id
        s.cliente_nome = cliente.razao_social
        s.status = "aberta"
        if not s.whatsapp_chat_id:
            s.whatsapp_chat_id = "559192516118@s.whatsapp.net"
        print(f"Solicitacao atualizada: {s.id} | {s.assunto}")

    for r in db.query(RascunhoIA).all():
        r.status = "pendente_aprovacao"
        r.despachado_whatsapp = False
        print(f"Rascunho resetado para pendente_aprovacao: {r.id}")

    db.commit()
    print("Sucesso!")
db.close()
