import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAdminRoomAvailability, fetchAdminRoomById, updateAdminRoom } from '../../api/adminApi'
import type { AdminRoom, AdminRoomAvailabilityDay } from '../../api/adminApi'
import './AdminPages.css'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// toISOString()은 UTC로 변환하므로 UTC보다 앞선 시간대(KST 등)에서는 자정 근처 날짜가
// 하루 밀려 나온다. 달력에 쓸 날짜는 반드시 로컬 기준 연/월/일 그대로 문자열로 만든다.
function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

// 조회 가능한 달의 범위를 만든다: 이번 달 ~ 이번 달로부터 1년 후까지(총 13개월).
// 과거 달은 예약 체크 대상이 아니므로 아예 조회 범위에서 제외한다.
function buildMonthOptions(minMonth: Date, maxMonth: Date): { value: string; label: string; date: Date }[] {
  const options: { value: string; label: string; date: Date }[] = []
  let cursor = minMonth
  while (cursor.getTime() <= maxMonth.getTime()) {
    options.push({
      value: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`,
      date: cursor,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return options
}

// 달력 6주 격자(월요일 시작이 아닌 일요일 시작)를 채운다. 이전/다음 달로 삐져나오는 칸은 null.
function buildMonthGrid(month: Date): (Date | null)[][] {
  const first = startOfMonth(month)
  const daysInMonth = endOfMonth(month).getDate()
  const cells: (Date | null)[] = new Array(first.getDay()).fill(null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day))
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

function AdminRoomDetailPage() {
  const { hotelId, roomId } = useParams<{ hotelId: string; roomId: string }>()
  const navigate = useNavigate()
  const roomKey = hotelId && roomId ? `${hotelId}:${roomId}` : undefined

  const [loadedRoomKey, setLoadedRoomKey] = useState<string | undefined>(undefined)
  const [room, setRoom] = useState<AdminRoom | null>(null)
  const [roomError, setRoomError] = useState('')
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const [loadedMonthKey, setLoadedMonthKey] = useState<string | undefined>(undefined)
  const [availByDate, setAvailByDate] = useState<Map<string, AdminRoomAvailabilityDay> | null>(null)
  const [availError, setAvailError] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // 객실이 바뀌면(다른 객실 상세로 이동) 렌더링 중에 바로 이전 정보를 비우고 달력도 이번 달로 되돌린다.
  if (loadedRoomKey !== roomKey) {
    setLoadedRoomKey(roomKey)
    setRoom(null)
    setRoomError('')
    setCurrentMonth(startOfMonth(new Date()))
    setIsEditing(false)
  }

  const monthKey = roomKey && `${roomKey}|${currentMonth.getFullYear()}-${currentMonth.getMonth()}`
  // 조회 중인 (객실, 달) 조합이 바뀌면 렌더링 중에 바로 이전 달의 색칠을 비워 헷갈리지 않게 한다.
  if (loadedMonthKey !== monthKey) {
    setLoadedMonthKey(monthKey)
    setAvailByDate(null)
    setAvailError('')
  }

  useEffect(() => {
    if (!hotelId || !roomId) return
    let ignore = false

    fetchAdminRoomById(hotelId, roomId)
      .then((data) => {
        if (!ignore) setRoom(data)
      })
      .catch((err) => {
        if (!ignore) setRoomError(err instanceof Error ? err.message : '객실 정보를 불러오지 못했습니다.')
      })

    return () => {
      ignore = true
    }
  }, [hotelId, roomId])

  const openEditForm = () => {
    if (!room) return
    setName(room.name)
    setCapacity(String(room.capacity))
    setDescription(room.description ?? '')
    setFormError('')
    setIsEditing(true)
  }

  const handleUpdateRoom = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!hotelId || !roomId) return

    const capacityNum = Number(capacity)
    if (!name.trim() || !Number.isInteger(capacityNum) || capacityNum < 1) {
      setFormError('이름과 정원(1 이상의 정수)을 올바르게 입력해주세요.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      const updated = await updateAdminRoom(hotelId, roomId, {
        name: name.trim(),
        capacity: capacityNum,
        description: description.trim() || undefined,
      })
      setRoom(updated)
      setIsEditing(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '객실 정보를 수정하지 못했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!hotelId || !roomId) return
    let ignore = false
    const start = toISODate(startOfMonth(currentMonth))
    const end = toISODate(endOfMonth(currentMonth))

    fetchAdminRoomAvailability(hotelId, roomId, start, end)
      .then((data) => {
        if (ignore) return
        // gRPC 응답이 빈 repeated 필드를 []가 아닌 undefined로 내려줄 수 있어 방어적으로 처리한다.
        setAvailByDate(new Map((data.availabilities ?? []).map((day) => [day.date, day])))
      })
      .catch((err) => {
        if (!ignore) setAvailError(err instanceof Error ? err.message : '예약 가능 여부를 불러오지 못했습니다.')
      })

    return () => {
      ignore = true
    }
  }, [hotelId, roomId, currentMonth])

  // 조회 가능 범위: 이번 달(하한, 과거로는 못 감) ~ 이번 달 + 1년(상한)
  const minMonth = startOfMonth(new Date())
  const maxMonth = new Date(minMonth.getFullYear(), minMonth.getMonth() + 12, 1)
  const isPrevDisabled = currentMonth.getTime() <= minMonth.getTime()
  const isNextDisabled = currentMonth.getTime() >= maxMonth.getTime()
  const monthOptions = buildMonthOptions(minMonth, maxMonth)

  const goPrevMonth = () => {
    setCurrentMonth((prev) => {
      const target = new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
      return target.getTime() < minMonth.getTime() ? prev : target
    })
  }
  const goNextMonth = () => {
    setCurrentMonth((prev) => {
      const target = new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      return target.getTime() > maxMonth.getTime() ? prev : target
    })
  }
  const handleSelectMonth = (value: string) => {
    const [year, month] = value.split('-').map(Number)
    const target = new Date(year, month, 1)
    if (target.getTime() < minMonth.getTime() || target.getTime() > maxMonth.getTime()) return
    setCurrentMonth(target)
  }

  const weeks = buildMonthGrid(currentMonth)
  const todayStr = toISODate(new Date())

  return (
    <section>
      <button
        type="button"
        className="admin-back-link"
        onClick={() => navigate(hotelId ? `/admin/hotels/${hotelId}` : '/admin/hotels')}
      >
        ← 호텔 상세로
      </button>

      <div className="admin-page-header">
        <h1>객실 상세</h1>
      </div>

      {roomError && <p className="admin-state is-error">{roomError}</p>}
      {!roomError && !room && <p className="admin-state">불러오는 중...</p>}

      {!roomError && room && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>객실 정보</h2>
            {!isEditing && (
              <button type="button" className="admin-btn is-primary" onClick={openEditForm}>
                수정
              </button>
            )}
          </div>

          {isEditing ? (
            <form className="admin-form" onSubmit={handleUpdateRoom} noValidate>
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
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button type="button" className="admin-btn" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  취소
                </button>
              </div>
            </form>
          ) : (
            <dl className="admin-detail-grid">
              <dt>ID</dt>
              <dd>{room.roomId}</dd>
              <dt>이름</dt>
              <dd>{room.name}</dd>
              <dt>정원</dt>
              <dd>{room.capacity}명</dd>
              <dt>설명</dt>
              <dd>{room.description || '-'}</dd>
            </dl>
          )}
        </div>
      )}

      {!roomError && room && (
        <div className="admin-card">
          <div className="admin-calendar-header">
            <button
              type="button"
              className="admin-calendar-nav"
              onClick={goPrevMonth}
              disabled={isPrevDisabled}
              aria-label="이전 달"
            >
              ‹
            </button>
            <select
              className="admin-calendar-title-select"
              value={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
              onChange={(e) => handleSelectMonth(e.target.value)}
              aria-label="조회할 달 선택 (이번 달 ~ 1년 후까지)"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="admin-calendar-nav"
              onClick={goNextMonth}
              disabled={isNextDisabled}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          {availError && <p className="admin-state is-error">{availError}</p>}

          <div className="admin-calendar">
            <div className="admin-calendar-weekdays">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div className="admin-calendar-week" key={weekIndex}>
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return <div key={dayIndex} className="admin-calendar-day is-outside" />
                  }

                  const dateStr = toISODate(date)
                  const day = availByDate?.get(dateStr)
                  const status = availByDate === null ? 'loading' : day ? (day.isAvailable ? 'available' : 'unavailable') : 'unknown'

                  return (
                    <div key={dayIndex} className={`admin-calendar-day is-${status}${dateStr === todayStr ? ' is-today' : ''}`}>
                      <span className="admin-calendar-date">{date.getDate()}</span>
                      {day && day.isAvailable && <span className="admin-calendar-price">{day.price.toLocaleString()}원</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="admin-calendar-legend">
            <span className="admin-calendar-legend-item">
              <i className="admin-calendar-dot is-available" />
              예약 가능
            </span>
            <span className="admin-calendar-legend-item">
              <i className="admin-calendar-dot is-unavailable" />
              예약 불가
            </span>
            <span className="admin-calendar-legend-item">
              <i className="admin-calendar-dot is-unknown" />
              데이터 없음
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminRoomDetailPage
