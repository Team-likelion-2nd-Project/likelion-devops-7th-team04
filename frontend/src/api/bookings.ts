import { customerAuth } from './tokenStore'

const BASE_URL = import.meta.env.VITE_API_URL

// gateway CreateBookingDto와 1:1 대응. userId는 서버가 Authorization 헤더의 JWT에서 추출하므로 실어 보내지 않는다.
export interface CreateBookingRequest {
  roomId: number
  hotelId: number
  checkInDate: string
  checkOutDate: string
  guestCount: number
  poolGuestCount?: number
  loungeGuestCount?: number
}

// proto의 Booking 메시지 / gateway BookingDto와 1:1 대응. 편의시설(수영장/라운지) 이용 여부/인원수는
// 여기 담기지 않는다 — fetchReservationFacilities로 별도 조회한다.
export interface Booking {
  reservationId: number
  userId: number
  roomId: number
  checkInDate: string
  checkOutDate: string
  guestCount: number
  totalAmount: number
  status: string
}

// proto의 ReservationFacilityItem 메시지와 1:1 대응되는 응답 형태
export interface ReservationFacility {
  reservationFacilityId: number
  reservationId: number
  facilityId: number
  facilityName: string
  guestCount: number
  totalAmount: number
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // ValidationPipe(class-validator) 에러는 message가 문자열 배열로 내려온다 (필드별 검증 메시지 여러 개).
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
    throw new Error(message ?? `${res.status} ${res.statusText}`)
  }
  return body as T
}

// POST /api/bookings — 로그인한 사용자 본인 명의로 신규 예약을 생성한다 (인증 필요).
// checkInDate~checkOutDate 전날까지 해당 객실이 예약 가능해야 하며, 금액은 서버가 자동 계산한다.
export async function createBooking(payload: CreateBookingRequest): Promise<Booking> {
  const token = customerAuth.getAccessToken()
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow<Booking>(res)
}

// GET /api/bookings/me — 로그인한 사용자 본인의 예약 목록을 조회한다 (인증 필요).
// 예약완료 페이지를 새로고침하거나 직접 접근했을 때(전달받은 state가 없을 때) 예약 정보를 다시
// 조회하는 용도로 쓴다 — 단건 조회 API가 따로 없어 목록에서 reservationId로 찾아 쓴다.
export async function fetchMyBookings(): Promise<Booking[]> {
  const token = customerAuth.getAccessToken()
  const res = await fetch(`${BASE_URL}/api/bookings/me`, {
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await parseJsonOrThrow<{ bookings: Booking[] }>(res)
  return data.bookings
}

// GET /api/bookings/{reservationId}/facilities — 해당 예약에 연결된 편의시설(수영장/라운지 등)
// 이용 내역을 조회한다 (인증 필요, 본인 예약이 아니면 403).
export async function fetchReservationFacilities(reservationId: number): Promise<ReservationFacility[]> {
  const token = customerAuth.getAccessToken()
  const res = await fetch(`${BASE_URL}/api/bookings/${reservationId}/facilities`, {
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await parseJsonOrThrow<{ facilities: ReservationFacility[] }>(res)
  return data.facilities
}
