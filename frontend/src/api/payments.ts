import { customerAuth } from './tokenStore'

const BASE_URL = import.meta.env.VITE_API_URL

// gateway CreatePaymentRequestDto와 1:1 대응. userId는 서버가 Authorization 헤더의 JWT에서 추출한다.
export interface CreatePaymentRequest {
  reservationId: number
  paymentMethod: string
}

// proto의 Payment 메시지 / gateway PaymentDto와 1:1 대응
export interface Payment {
  paymentId: number
  reservationId: number
  approvalNumber: string
  amount: number
  paymentMethod: string
  status: string
  paidAt: string
  userId: number
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

// POST /api/payments — 로그인한 사용자 본인 명의의 예약에 대해 결제를 요청한다 (인증 필요).
// payment-service가 예약 금액/소유자/상태를 검증하고 PG(mock)에 승인을 동기로 요청한 뒤, 성공하면
// 결제내역을 저장하고 해당 예약을 PENDING_PAYMENT -> RESERVED로 확정한다.
export async function createPayment(payload: CreatePaymentRequest): Promise<Payment> {
  const token = customerAuth.getAccessToken()
  const res = await fetch(`${BASE_URL}/api/payments`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow<Payment>(res)
}

// GET /api/payments/me — 로그인한 사용자 본인의 결제 목록을 조회한다 (인증 필요).
// payment-service가 paidAt 최신순으로 정렬해서 내려준다.
export async function fetchMyPayments(): Promise<Payment[]> {
  const token = customerAuth.getAccessToken()
  const res = await fetch(`${BASE_URL}/api/payments/me`, {
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await parseJsonOrThrow<{ payments: Payment[] }>(res)
  return data.payments
}
