import { Link } from 'react-router-dom'
import type { Room } from '../api/hotels'
import './RoomCard.css'

interface RoomCardProps {
  room: Room
  /** 라우팅용 호텔 slug (mock hotels.ts의 문자열 id) */
  hotelSlug: string
}

function RoomCard({ room, hotelSlug }: RoomCardProps) {
  return (
    <Link to={`/hotels/${hotelSlug}/rooms/${room.roomId}`} className="room-card">
      {/* TODO: 실제 객실 사진으로 교체 */}
      <div className="room-card-image" aria-hidden="true" />
      <div className="room-card-body">
        <h3 className="room-card-name">{room.name}</h3>
        <p className="room-card-capacity">기준 인원 {room.capacity}명</p>
        <p className="room-card-description">{room.description}</p>
      </div>
    </Link>
  )
}

export default RoomCard
