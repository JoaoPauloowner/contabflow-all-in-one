export interface UserSession {
  user_id: string;
  tenant_id: string;
  cliente_id?: string | null;
  role: "ADMIN_ESCRITORIO" | "OPERADOR_ESCRITORIO" | "CLIENTE";
  nome: string;
  email: string;
}

const TOKEN_KEY = "contabflow_jwt_token";
const USER_KEY = "contabflow_user_data";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: UserSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax`;
  document.cookie = `role=${user.role}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "token=; path=/; max-age=0";
  document.cookie = "role=; path=/; max-age=0";
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && typeof window !== "undefined") {
    clearSession();
    if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/cadastro")) {
      window.location.href = "/login?expirado=true";
    }
  }

  return response;
}
