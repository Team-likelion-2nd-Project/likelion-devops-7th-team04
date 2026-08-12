const BASE_URL = import.meta.env.VITE_API_URL

// proto의 Room 메시지 / gateway RoomDto와 1:1 대응
export interface Room {
  roomId: number
  hotelId: number
  name: string
  capacity: number
  description: string
}

interface RoomListResponse {
  rooms: Room[]
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json()
}

// GET /api/hotels/{hotelId}/rooms — 특정 호텔의 전체 객실 목록 조회 (인증 불필요)
export async function fetchRooms(hotelId: number): Promise<Room[]> {
  const res = await fetch(`${BASE_URL}/api/hotels/${hotelId}/rooms`)
  const data = await parseJsonOrThrow<RoomListResponse>(res)
  return data.rooms
}

// GET /api/hotels/{hotelId}/rooms/{roomId} — 단건 객실 상세 조회 (인증 불필요)
export async function fetchRoom(hotelId: number, roomId: number): Promise<Room> {
  const res = await fetch(`${BASE_URL}/api/hotels/${hotelId}/rooms/${roomId}`)
  return parseJsonOrThrow<Room>(res)
}
