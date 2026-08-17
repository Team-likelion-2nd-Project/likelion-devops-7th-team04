// 예약 관련 페이지에서 쓰는 날짜 계산·포맷 유틸. Date 객체를 직접 다루는 순수 함수들만 모아둔다.

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

export function formatDateWithWeekday(date: Date): string {
  return `${formatDate(date)}(${WEEKDAYS_KO[date.getDay()]})`
}

/** api-gateway가 쓰는 "YYYY-MM-DD" 형식 문자열을 Date로 변환한다. 형식이 올바르지 않으면 null */
export function parseDateISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** a - b 사이의 일수 차이(박 수 계산 등에 사용). a가 b보다 미래면 양수 */
export function diffDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY)
}
