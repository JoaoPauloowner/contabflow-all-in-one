"""
Rate Limiter em memória com Janela Deslizante (Sliding Window) para proteção contra Brute Force e Flooding.
"""
import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self, requests_per_minute: int = 15):
        self.requests_per_minute = requests_per_minute
        self.history: Dict[str, List[float]] = defaultdict(list)

    def __call__(self, request: Request):
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "127.0.0.1")
        )

        now = time.time()
        window_start = now - 60.0

        # Limpa timestamps mais antigos que 60 segundos
        valid_requests = [ts for ts in self.history[client_ip] if ts > window_start]
        self.history[client_ip] = valid_requests

        if len(valid_requests) >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Limite de requisições excedido ({self.requests_per_minute}/min). Tente novamente em alguns instantes.",
            )

        self.history[client_ip].append(now)


# Instâncias especializadas para diferentes rotas críticas
login_rate_limiter = InMemoryRateLimiter(requests_per_minute=20)
webhook_rate_limiter = InMemoryRateLimiter(requests_per_minute=180)
