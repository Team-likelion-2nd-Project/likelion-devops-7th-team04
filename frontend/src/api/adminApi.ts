import { clearAccessToken, getAccessToken } from './tokenStore'
import { refreshAccessToken } from './gateway'

const BASE_URL = import.meta.env.VITE_API_URL

// api-gateway의 /api/users 응답(UserResponse)과 1:1 대응
export interface AdminUser {
  id: number
  email: string
  name: string
  phoneNumber: string
  role: string
  status: string
}

// api-gateway의 /api/hotels 응답(HotelDto)과 1:1 대응
export interface AdminHotel {
  hotelId: number
  name: string
  address: string
  phoneNumber: string
  description: string
}

// api-gateway의 /api/hotels/:hotelId/rooms 응답(RoomDto)과 1:1 대응
export interface AdminRoom {
  roomId: number
  hotelId: number
  name: string
  capacity: number
  description: string
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
    throw new Error(message ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

// 액세스 토큰을 Authorization 헤더에 실어 관리자 전용 API를 호출한다.
// 토큰이 만료되어 401이 오면 리프레시 토큰(쿠키)으로 한 번만 재발급을 시도한 뒤 재요청하고,
// 그마저 실패하면 로그인 세션을 정리하고 에러를 던진다 (AdminGuard가 로그인 페이지로 돌려보낸다).
async function authedFetch(path: string): Promise<Response> {
  const token = getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: 'include',
  })

  if (res.status !== 401) {
    return res
  }

  try {
    await refreshAccessToken()
  } catch {
    clearAccessToken()
    throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.')
  }

  const retryToken = getAccessToken()
  return fetch(`${BASE_URL}${path}`, {
    headers: retryToken ? { Authorization: `Bearer ${retryToken}` } : undefined,
    credentials: 'include',
  })
}

// GET /api/users (관리자 전용) - 전체 유저 목록
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await authedFetch('/api/users')
  const data = await parseJson<{ users: AdminUser[] }>(res)
  return data.users
}

// GET /api/users/:userId (관리자 전용) - 유저 상세
export async function fetchAdminUserById(userId: string | number): Promise<AdminUser> {
  const res = await authedFetch(`/api/users/${userId}`)
  return parseJson<AdminUser>(res)
}

// GET /api/hotels - 전체 호텔 목록 (공개 API지만 관리자 화면에서도 동일하게 사용)
export async function fetchAdminHotels(): Promise<AdminHotel[]> {
  const res = await authedFetch('/api/hotels')
  const data = await parseJson<{ hotels: AdminHotel[] }>(res)
  return data.hotels
}

// GET /api/hotels/:hotelId - 호텔 상세
export async function fetchAdminHotelById(hotelId: string | number): Promise<AdminHotel> {
  const res = await authedFetch(`/api/hotels/${hotelId}`)
  return parseJson<AdminHotel>(res)
}

// GET /api/hotels/:hotelId/rooms - 호텔의 객실 목록
export async function fetchAdminHotelRooms(hotelId: string | number): Promise<AdminRoom[]> {
  const res = await authedFetch(`/api/hotels/${hotelId}/rooms`)
  const data = await parseJson<{ rooms: AdminRoom[] }>(res)
  return data.rooms
}
