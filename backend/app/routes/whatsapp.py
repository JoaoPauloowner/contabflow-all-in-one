import logging
import httpx
from fastapi import APIRouter
from app.core.config import settings

logger = logging.getLogger("contabflow.routes.whatsapp")
router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Status & Conexão"])

@router.get("/status")
async def obter_status_whatsapp():
    """
    Consulta o estado de conexão da instância no Evolution API / Bridge.
    Retorna formato compatível com o modal do portal do contador:
    {
        "isConnected": bool,
        "qrDataUrl": Optional[str],
        "userPhone": Optional[str],
        "status": str
    }
    """
    headers = {
        "apikey": settings.WHATSAPP_WEBHOOK_SECRET,
    }
    inst = getattr(settings, "WHATSAPP_INSTANCE_NAME", "contabflow_instance")
    
    # 1. Checa estado no Evolution API
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            url_state = f"{settings.WHATSAPP_BRIDGE_URL}/instance/connectionState/{inst}"
            resp = await client.get(url_state, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                inst_data = data.get("instance", {})
                state = inst_data.get("state", "close")
                
                if state == "open":
                    owner = inst_data.get("ownerJid") or inst_data.get("owner") or ""
                    phone = owner.split("@")[0] if "@" in owner else owner
                    return {
                        "isConnected": True,
                        "qrDataUrl": None,
                        "userPhone": phone,
                        "status": "CONNECTED"
                    }
                
                # Se não está open, busca o QR Code
                url_connect = f"{settings.WHATSAPP_BRIDGE_URL}/instance/connect/{inst}"
                resp_qr = await client.get(url_connect, headers=headers)
                qr_b64 = None
                if resp_qr.status_code in (200, 201):
                    qr_data = resp_qr.json()
                    raw_b64 = qr_data.get("base64")
                    if raw_b64:
                        qr_b64 = raw_b64 if raw_b64.startswith("data:") else f"data:image/png;base64,{raw_b64}"
                
                return {
                    "isConnected": False,
                    "qrDataUrl": qr_b64,
                    "userPhone": None,
                    "status": state
                }
    except Exception as e:
        logger.warning(f"Erro ao consultar status da Evolution API: {e}")

    # 2. Fallback para bridge legado /status
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp_local = await client.get(f"{settings.WHATSAPP_BRIDGE_URL}/status")
            if resp_local.status_code == 200:
                return resp_local.json()
    except Exception:
        pass

    return {
        "isConnected": False,
        "qrDataUrl": None,
        "userPhone": None,
        "status": "DISCONNECTED"
    }
