import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAdminRoom, fetchAdminHotelById, fetchAdminHotelRooms } from '../../api/adminApi'
import type { AdminHotel, AdminRoom } from '../../api/adminApi'
import './AdminPages.css'

function AdminHotelDetailPage() {
  const { hotelId } = useParams<{ hotelId: string }>()
  const navigate = useNavigate()
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined)
  const [hotel, setHotel] = useState<AdminHotel | null>(null)
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null)
  const [error, setError] = useState('')

  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // hotelId가 바뀌면(다른 호텔 상세로 이동) 렌더링 중에 바로 이전 데이터를 비워
  // 새 호텔의 데이터가 도착하기 전까지 이전 호텔 정보가 잠깐 보이지 않게 한다.
  if (loadedFor !== hotelId) {
    setLoadedFor(hotelId)
    setHotel(null)
    setRooms(null)
    setError('')
    setIsAdding(false)
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

  const openAddForm = () => {
    setName('')
    setCapacity('')
    setDescription('')
    setFormError('')
    setIsAdding(true)
  }

  const handleAddRoom = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!hotelId) return

    const capacityNum = Number(capacity)
    if (!name.trim() || !Number.isInteger(capacityNum) || capacityNum < 1) {
      setFormError('이름과 정원(1 이상의 정수)을 올바르게 입력해주세요.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      const created = await createAdminRoom(hotelId, {
        name: name.trim(),
        capacity: capacityNum,
        description: description.trim() || undefined,
      })
      setRooms((prev) => [...(prev ?? []), created])
      setIsAdding(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '객실을 등록하지 못했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

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
          <div className="admin-card-header">
            <h2>객실 목록</h2>
            {!isAdding && (
              <button type="button" className="admin-btn is-primary" onClick={openAddForm}>
                객실 추가
              </button>
            )}
          </div>
          <p className="admin-stat-note" style={{ marginBottom: 12 }}>
            객실을 누르면 상세 정보와 예약 가능 날짜 달력을 볼 수 있습니다.
          </p>

          {isAdding && (
            <form className="admin-form" onSubmit={handleAddRoom} noValidate>
              <label className="admin-form-row">
                <span>이름</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
              </label>
              <label className="admin-form-row">
                <span>정원</span>
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
              </label>
              <label className="admin-form-row">
                <span>설명</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>

              {formError && <p className="admin-form-error">{formError}</p>}

              <div className="admin-form-actions">
                <button type="submit" className="admin-btn is-primary" disabled={isSaving}>
                  {isSaving ? '등록 중...' : '등록'}
                </button>
                <button type="button" className="admin-btn" onClick={() => setIsAdding(false)} disabled={isSaving}>
                  취소
                </button>
              </div>
            </form>
          )}

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
                    <tr
                      key={room.roomId}
                      onClick={() => navigate(`/admin/hotels/${hotelId}/rooms/${room.roomId}`)}
                    >
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
