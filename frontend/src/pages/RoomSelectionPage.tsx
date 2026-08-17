import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HOTELS } from '../data/hotels'
import { fetchRoomAvailability, fetchRooms, toImageDataUrl } from '../api/hotels'
import type { Room } from '../api/hotels'
import ReservationSteps from '../components/reservation/ReservationSteps'
import RoomDetailModal from '../components/reservation/RoomDetailModal'
import { sumGuests } from '../components/reservation/guestTypes'
import { CalendarIcon, PersonIcon, PinIcon, RefreshIcon } from '../components/reservation/icons'
import { addDays, diffDays, formatDateISO, formatDateWithWeekday } from '../utils/date'
import { parseReservationSearchParams, toReservationSearchParams } from '../utils/reservationQuery'
import './RoomSelectionPage.css'

type ListStatus = 'loading' | 'success' | 'error'

interface RoomAvailabilityInfo {
  status: ListStatus
  isAvailable?: boolean
  /** 조회 구간 중 가장 저렴한 1박 요금 */
  minPrice?: number | null
}

type SortOrder = 'price-asc' | 'price-desc'

function RoomSelectionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 1단계(호텔/날짜/투숙인원 선택)에서 쿼리스트링으로 실어 보낸 검색 조건.
  const search = useMemo(() => parseReservationSearchParams(searchParams), [searchParams])
  const hotel = search ? HOTELS.find((h) => h.id === search.hotelSlug) ?? null : null

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsStatus, setRoomsStatus] = useState<ListStatus>('loading')
  const [roomsError, setRoomsError] = useState('')
  const [availabilityMap, setAvailabilityMap] = useState<Record<number, RoomAvailabilityInfo>>({})
  const [sortOrder, setSortOrder] = useState<SortOrder>('price-asc')
  const [detailRoom, setDetailRoom] = useState<Room | null>(null)

  // 검색 조건이 없거나 (예: 페이지 직접 접근) 존재하지 않는 호텔이면 1단계로 돌려보낸다.
  useEffect(() => {
    if (!search || !hotel) {
      navigate('/reservation', { replace: true })
    }
  }, [search, hotel, navigate])

  useEffect(() => {
    if (!search || !hotel) return
    let cancelled = false

    setRoomsStatus('loading')
    setRoomsError('')
    setAvailabilityMap({})

    // 예약 가능 여부/가격 조회는 "묵는 마지막 날 밤"까지만 포함한다 — 체크아웃 당일은 밤을 보내지 않는다.
    const startDate = formatDateISO(search.checkIn)
    const endDate = formatDateISO(addDays(search.checkOut, -1))

    fetchRooms(hotel.hotelId)
      .then(async (data) => {
        if (cancelled) return
        setRooms(data)
        setRoomsStatus('success')

        const entries = await Promise.all(
          data.map(async (room): Promise<[number, RoomAvailabilityInfo]> => {
            try {
              const availability = await fetchRoomAvailability(hotel.hotelId, room.roomId, startDate, endDate)
              const prices = availability.availabilities.map((day) => day.price)
              const minPrice = prices.length > 0 ? Math.min(...prices) : null
              return [room.roomId, { status: 'success', isAvailable: availability.isAvailable, minPrice }]
            } catch {
              return [room.roomId, { status: 'error' }]
            }
          }),
        )
        if (cancelled) return
        setAvailabilityMap(Object.fromEntries(entries))
      })
      .catch((err) => {
        if (cancelled) return
        setRoomsStatus('error')
        setRoomsError(err instanceof Error ? err.message : '알 수 없는 오류')
      })

    return () => {
      cancelled = true
    }
  }, [search, hotel])

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const priceA = availabilityMap[a.roomId]?.minPrice
      const priceB = availabilityMap[b.roomId]?.minPrice
      if (priceA == null && priceB == null) return 0
      if (priceA == null) return 1
      if (priceB == null) return -1
      return sortOrder === 'price-asc' ? priceA - priceB : priceB - priceA
    })
  }, [rooms, availabilityMap, sortOrder])

  // "선택"한 객실 정보까지 실어서 다음 단계(옵션 선택)로 이동한다.
  const handleSelectRoom = (room: Room) => {
    if (!search) return
    const params = toReservationSearchParams(search)
    params.set('room', String(room.roomId))
    navigate(`/reservation/options?${params.toString()}`)
  }

  if (!search || !hotel) {
    // useEffect가 /reservation으로 돌려보내는 동안 잠깐 보여줄 빈 화면
    return null
  }

  const nights = diffDays(search.checkOut, search.checkIn)
  const guests = sumGuests(search.rooms)
  const backToSearchUrl = `/reservation?${toReservationSearchParams(search).toString()}`

  return (
    <section className="room-selection-page">
      <div className="reservation-page-header">
        <h1>객실예약</h1>
        <ReservationSteps activeStep={1} />
      </div>

      <div className="room-selection-body">
        <div className="room-selection-main">
          <div className="room-selection-toolbar">
            <p className="room-selection-count">
              {roomsStatus === 'success' ? `${hotel.name} · 총 ${rooms.length}개 객실` : hotel.name}
            </p>
            <label className="room-selection-sort">
              정렬
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}>
                <option value="price-asc">낮은가격순</option>
                <option value="price-desc">높은가격순</option>
              </select>
            </label>
          </div>

          {roomsStatus === 'loading' && <p className="room-selection-status">객실 정보를 불러오는 중입니다…</p>}
          {roomsStatus === 'error' && (
            <p className="room-selection-status error">객실 정보를 불러오지 못했습니다: {roomsError}</p>
          )}
          {roomsStatus === 'success' && sortedRooms.length === 0 && (
            <p className="room-selection-status">현재 등록된 객실이 없습니다.</p>
          )}

          {roomsStatus === 'success' && sortedRooms.length > 0 && (
            <ul className="room-select-list">
              {sortedRooms.map((room) => {
                const availability = availabilityMap[room.roomId]
                const thumbnail = room.images[0]
                const canSelect = availability?.status === 'success' && availability.isAvailable && availability.minPrice != null

                return (
                  <li className="room-select-card" key={room.roomId}>
                    {thumbnail ? (
                      <img className="room-select-thumb" src={toImageDataUrl(thumbnail)} alt={room.name} />
                    ) : (
                      <div className="room-select-thumb is-placeholder" aria-hidden="true" />
                    )}

                    <div className="room-select-body">
                      <div className="room-select-heading">
                        <h3 className="room-select-name">{room.name}</h3>
                        <button
                          type="button"
                          className="room-select-detail-link"
                          onClick={() => setDetailRoom(room)}
                        >
                          상세보기 ›
                        </button>
                      </div>
                      <p className="room-select-capacity">기준 인원 {room.capacity}명</p>

                      <div className="room-select-inline-price">
                        {(!availability || availability.status === 'loading') && <p>가격 조회 중…</p>}
                        {availability?.status === 'error' && <p className="error">가격 정보를 불러오지 못했습니다</p>}
                        {availability?.status === 'success' &&
                          (canSelect ? (
                            <p>
                              최저가 <strong>{availability.minPrice!.toLocaleString()}원~</strong>
                              <span className="room-select-price-unit">{nights}박</span>
                            </p>
                          ) : (
                            <p className="is-soldout">선택한 기간에 예약이 마감되었습니다</p>
                          ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="room-select-button"
                      disabled={!canSelect}
                      onClick={() => handleSelectRoom(room)}
                    >
                      선택
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <aside className="room-selection-summary">
          <div className="room-selection-summary-header">
            <Link className="room-selection-refresh" to={backToSearchUrl}>
              <RefreshIcon /> 재검색
            </Link>
          </div>

          <div className="room-selection-summary-info">
            <div className="room-selection-summary-row">
              <span className="room-selection-summary-label">
                <PinIcon /> 호텔/지역
              </span>
              <span className="room-selection-summary-value">{hotel.name}</span>
            </div>

            <div className="room-selection-summary-row">
              <span className="room-selection-summary-label">
                <CalendarIcon /> 체크인/체크아웃
              </span>
              <span className="room-selection-summary-value">
                {formatDateWithWeekday(search.checkIn)} - {formatDateWithWeekday(search.checkOut)} · {nights}박
              </span>
            </div>

            <div className="room-selection-summary-row">
              <span className="room-selection-summary-label">
                <PersonIcon /> 투숙인원
              </span>
              <span className="room-selection-summary-value">
                총인원 {guests.adults + guests.children + guests.infants} · 성인 {guests.adults}, 어린이{' '}
                {guests.children}, 유아 {guests.infants}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {detailRoom && <RoomDetailModal room={detailRoom} onClose={() => setDetailRoom(null)} />}
    </section>
  )
}

export default RoomSelectionPage
