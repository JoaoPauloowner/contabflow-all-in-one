import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.security import create_access_token
from app.database.session import SessionLocal
from app.models import Usuario

db = SessionLocal()
user = db.query(Usuario).filter(Usuario.role == "ADMIN_ESCRITORIO").first()
token = create_access_token(subject=user.id, role=user.role, tenant_id=user.tenant_id)
headers = {"Authorization": f"Bearer {token}"}
import httpx
client = httpx.Client(base_url="http://127.0.0.1:8000")
res_r = client.get("/api/v1/ia/rascunhos", headers=headers)
rascunhos = res_r.json()
print("Total rascunhos:", len(rascunhos))
r = rascunhos[0]
print("Rascunho:", r["id"], r["status"])

res_app = client.post(
    f"/api/v1/ia/rascunhos/{r['id']}/aprovar",
    headers=headers,
    json={"despachar_whatsapp": True, "conteudo_final": r["conteudo_original"]}
)
print("Status aprovacao:", res_app.status_code)
print("Despachado:", res_app.json().get("despachado_whatsapp"))

