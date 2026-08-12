import { clearAccessToken, getAccessToken, setAuth } from './tokenStore'

const BASE_URL = import.meta.env.VITE_API_URL

export interface HelloResponse {
  message: string
}

export interface ServiceConfig {
  key: string
  label: string
  path: string
}

// api-gateway(3000)가 gRPC로 프록시하는 서비스별 테스트 엔드포인트 목록
export const SERVICES: ServiceConfig[] = [
  { key: 'users', label: 'User Service', path: '/api/users/hello' },
  { key: 'hotels', label: 'Hotel Service', path: '/api/hotels/hello' },
  { key: 'bookings', label: 'Booking Service', path: '/api/bookings/hello' },
  { key: 'payments', label: 'Payment Service', path: '/api/payments/hello' },
  { key: 'chat-bots', label: 'Chat-bot Service', path: '/api/chat-bots/hello' },
]

export async function fetchHello(path: string): Promise<HelloResponse> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json()
}

export interface LoginRequest {
  email: string
  password: string
}

// 서버가 리프레시 토큰은 httpOnly 쿠키로 내려주고, 응답 바디에는 액세스 토큰 + 유저 정보만 담아준다.
export interface AuthResponse {
  accessToken: string
  userId: number
  email: string
  name: string
  role: string
}

async function parseAuthResponse(res: Response): Promise<AuthResponse> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `${res.status} ${res.statusText}`)
  }

  const data: AuthResponse = await res.json()
  setAuth(data.accessToken, {
    userId: data.userId,
    email: data.email,
    name: data.name,
    role: data.role,
  })
  return data
}

// api-gateway(/api/auth/login) -> auth-service(gRPC)로 이메일/비밀번호를 검증하고 토큰을 발급받는다.
// credentials: 'include'가 있어야 서버가 Set-Cookie로 내려주는 httpOnly 리프레시 토큰을 브라우저가 저장한다.
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  return parseAuthResponse(res)
}

// httpOnly 리프레시 토큰 쿠키로 액세스 토큰을 재발급받는다. 새로고침 등으로 메모리의 액세스 토큰이
// 사라졌을 때 세션을 복구하는 용도 (쿠키가 없거나 만료됐으면 401 -> 비로그인 상태로 처리).
export async function refreshAccessToken(): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  return parseAuthResponse(res)
}

// 서버에 로그아웃을 알려 리프레시 토큰(쿠키)을 무효화하고, 메모리의 액세스 토큰도 즉시 버린다.
// 서버 호출이 실패해도(네트워크 오류 등) 클라이언트 쪽 로그인 상태는 반드시 해제한다.
export async function logout(): Promise<void> {
  const token = getAccessToken()

  try {
    if (token) {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } finally {
    clearAccessToken()
  }
}
