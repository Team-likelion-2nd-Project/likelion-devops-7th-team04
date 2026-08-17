import { customerAuth, adminAuth } from './tokenStore'
import type { AuthStore } from './tokenStore'

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

// store 인자로 고객(customerAuth)/관리자(adminAuth) 중 어느 메모리 저장소에 반영할지 정한다.
async function parseAuthResponse(res: Response, store: AuthStore): Promise<AuthResponse> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    // ValidationPipe(class-validator) 에러는 message가 문자열 배열로 내려온다 (필드별 검증 메시지 여러 개).
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
    throw new Error(message ?? `${res.status} ${res.statusText}`)
  }

  const data: AuthResponse = await res.json()
  store.setAuth(data.accessToken, {
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

  return parseAuthResponse(res, customerAuth)
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  phoneNumber: string
}

// api-gateway(/api/auth/register) -> auth-service(gRPC)로 회원가입을 요청하고, 성공 시 로그인과 동일하게 토큰을 발급받는다.
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  return parseAuthResponse(res, customerAuth)
}

// 액세스 토큰(메모리)을 Authorization 헤더에 실어 보내는 공통 fetch. 마이페이지 등 로그인 필요한 API에서 사용.
async function authorizedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = customerAuth.getAccessToken()
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // ValidationPipe(class-validator) 에러는 message가 문자열 배열로 내려온다 (필드별 검증 메시지 여러 개).
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
    throw new Error(message ?? `${res.status} ${res.statusText}`)
  }
  return body as T
}

// proto의 User 메시지와 1:1 대응되는 응답 형태 (api-gateway UserController의 UserResponse와 동일)
export interface UserProfile {
  id: number
  email: string
  name: string
  phoneNumber: string
  role: string
  status: string
}

// api-gateway(GET /api/users/me) -> user-service(gRPC)로 로그인한 사용자 본인의 프로필을 조회한다.
export async function fetchMe(): Promise<UserProfile> {
  const res = await authorizedFetch('/api/users/me')
  return parseJsonResponse<UserProfile>(res)
}

export interface UpdateMeRequest {
  name: string
  phoneNumber: string
}

// api-gateway(PUT /api/users/me) -> user-service(gRPC)로 이름/전화번호를 수정한다.
export async function updateMe(payload: UpdateMeRequest): Promise<UserProfile> {
  const res = await authorizedFetch('/api/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const profile = await parseJsonResponse<UserProfile>(res)
  // 헤더의 "OO님" 표시 등이 즉시 반영되도록 메모리에 캐시된 유저 정보도 함께 갱신한다.
  customerAuth.setUser({ userId: profile.id, email: profile.email, name: profile.name, role: profile.role })
  return profile
}

// api-gateway(DELETE /api/users/me) -> auth-service(gRPC)로 회원 탈퇴를 요청한다.
// 성공 시 서버의 프로필/자격증명/세션이 모두 정리되므로, 클라이언트도 메모리의 액세스 토큰을 즉시 버린다.
export async function withdrawMe(): Promise<{ message: string }> {
  const res = await authorizedFetch('/api/users/me', { method: 'DELETE' })
  const result = await parseJsonResponse<{ message: string }>(res)
  customerAuth.clearAccessToken()
  return result
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// api-gateway(PATCH /api/auth/password) -> auth-service(gRPC)로 비밀번호를 변경한다.
// 성공 시 서버가 이 계정의 모든 리프레시 토큰(세션)을 무효화하므로, 프론트도 이어서 로그아웃 처리를 해야 한다.
export async function changePassword(payload: ChangePasswordRequest): Promise<{ message: string }> {
  const res = await authorizedFetch('/api/auth/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse<{ message: string }>(res)
}

// api-gateway(/api/auth/admin/login) -> auth-service(gRPC)로 이메일/비밀번호를 검증하고 토큰을 발급받는다.
// 고객 로그인(login)과 엔드포인트가 완전히 분리되어 있으며, admins 테이블에 등록된 계정만 성공한다
// (customers 계정으로는 애초에 이메일 조회 단계에서 실패하므로 role을 별도로 검증할 필요가 없다).
export async function adminLogin(payload: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  return parseAuthResponse(res, adminAuth)
}

// httpOnly 리프레시 토큰 쿠키(refreshToken, 고객 전용)로 액세스 토큰을 재발급받는다. 새로고침 등으로
// 메모리의 액세스 토큰이 사라졌을 때 세션을 복구하는 용도 (쿠키가 없거나 만료됐으면 401 -> 비로그인 상태로 처리).
export async function refreshAccessToken(): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  return parseAuthResponse(res, customerAuth)
}

// proto의 Booking 메시지와 1:1 대응되는 응답 형태 (api-gateway BookingController의 BookingDto와 동일)
export interface Booking {
  reservationId: number
  userId: number
  roomId: number
  checkInDate: string
  checkOutDate: string
  guestCount: number
  hasIndoorPool: boolean
  hasLounge: boolean
  totalAmount: number
  status: 'RESERVED' | 'CANCELLED' | 'COMPLETED'
}

// api-gateway(GET /api/bookings/me) -> booking-service(gRPC)로 로그인한 사용자 본인의 예약 목록을 조회한다.
export async function fetchMyBookings(): Promise<Booking[]> {
  const res = await authorizedFetch('/api/bookings/me')
  const data = await parseJsonResponse<{ bookings: Booking[] }>(res)
  return data.bookings
}

// api-gateway(PUT /api/bookings/{reservationId}) -> booking-service(gRPC)로 예약을 취소한다.
export async function cancelBooking(reservationId: number): Promise<Booking> {
  const res = await authorizedFetch(`/api/bookings/${reservationId}`, { method: 'PUT' })
  return parseJsonResponse<Booking>(res)
}

// 관리자 전용 재발급. adminRefreshToken 쿠키를 사용하며, 고객 세션(refreshToken)에는 영향을 주지 않는다.
export async function refreshAdminAccessToken(): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/admin/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  return parseAuthResponse(res, adminAuth)
}

// 서버에 로그아웃을 알려 리프레시 토큰(쿠키)을 무효화하고, 메모리의 액세스 토큰도 즉시 버린다.
// 서버 호출이 실패해도(네트워크 오류 등) 클라이언트 쪽 로그인 상태는 반드시 해제한다.
async function logoutFrom(store: AuthStore): Promise<void> {
  const token = store.getAccessToken()

  try {
    if (token) {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } finally {
    store.clearAccessToken()
  }
}

// 고객 로그아웃. 서버는 Authorization 헤더의 액세스 토큰으로 principal 타입을 판별해
// refreshToken 쿠키만 지우므로, 같은 브라우저의 관리자 세션(adminRefreshToken)에는 영향이 없다.
export function logout(): Promise<void> {
  return logoutFrom(customerAuth)
}

// 관리자 로그아웃. adminAuth 스토어와 adminRefreshToken 쿠키만 정리한다.
export function adminLogout(): Promise<void> {
  return logoutFrom(adminAuth)
}
