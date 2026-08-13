import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAdminHotelById, fetchAdminHotelRooms } from '../../api/adminApi'
import type { AdminHotel, AdminRoom } from '../../api/adminApi'
import './AdminPages.css'

function AdminHotelDetailPage() {
  const { hotelId } = useParams<{ hotelId: string }>()
  const navigate = useNavigate()
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined)
  const [hotel, setHotel] = useState<AdminHotel | null>(null)
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null)
  const [error, setError] = useState('')

  // hotelId가 바뀌면(다른 호텔 상세로 이동) 렌더링 중에 바로 이전 데이터를 비워
  // 새 호텔의 데이터가 도착하기 전까지 이전 호텔 정보가 잠깐 보이지 않게 한다.
  if (loadedFor !== hotelId) {
    setLoadedFor(hotelId)
    setHotel(null)
    setRooms(null)
    setError('')
  }

  useEffect(() => {
    if (!hotelId) return
    let ignore = false

    Promise.all([fetchAdminHotelById(hotelId), fetchAdminHotelRooms(hotelId)])
      .then(([hotelData, roomsData]) => {
        if (ignore) return
        setHotel(hotelData)
        setRooms(roomsData)
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : '호텔 정보를 불러오지 못했습니다.')
      })

    return () => {
      ignore = true
    }
  }, [hotelId])

  return (
    <section>
      <button type="button" className="admin-back-link" onClick={() => navigate('/admin/hotels')}>
        ← 호텔 목록으로
      </button>

      <div className="admin-page-header">
        <h1>호텔 상세</h1>
      </div>

      {error && <p className="admin-state is-error">{error}</p>}
      {!error && !hotel && <p className="admin-state">불러오는 중...</p>}

      {!error && hotel && (
        <div className="admin-card">
          <dl className="admin-detail-grid">
            <dt>ID</dt>
            <dd>{hotel.hotelId}</dd>
            <dt>이름</dt>
            <dd>{hotel.name}</dd>
            <dt>주소</dt>
            <dd>{hotel.address}</dd>
            <dt>전화번호</dt>
            <dd>{hotel.phoneNumber}</dd>
            <dt>설명</dt>
            <dd>{hotel.description || '-'}</dd>
          </dl>
        </div>
      )}

      {!error && rooms && (
        <div className="admin-card">
          <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>객실 목록</h2>
          {rooms.length === 0 ? (
            <p className="admin-state">등록된 객실이 없습니다.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>이름</th>
                    <th>정원</th>
                    <th>설명</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.roomId} style={{ cursor: 'default' }}>
                      <td>{room.roomId}</td>
                      <td>{room.name}</td>
                      <td>{room.capacity}</td>
                      <td>{room.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default AdminHotelDetailPage
