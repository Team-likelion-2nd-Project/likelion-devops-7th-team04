const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

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
