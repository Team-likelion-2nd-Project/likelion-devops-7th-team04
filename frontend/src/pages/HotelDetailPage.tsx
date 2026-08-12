import { useParams } from 'react-router-dom'
import { HOTELS } from '../data/hotels'
import PlaceholderPage from '../components/PlaceholderPage'

function HotelDetailPage() {
  const { hotelId } = useParams<{ hotelId: string }>()
  const hotel = HOTELS.find((h) => h.id === hotelId)

  return (
    <PlaceholderPage
      title={hotel ? hotel.name : '호텔을 찾을 수 없습니다'}
      description={hotel ? `${hotel.location} · 상세 페이지는 준비 중입니다.` : undefined}
    />
  )
}

export default HotelDetailPage
