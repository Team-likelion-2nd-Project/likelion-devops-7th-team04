import PlaceholderPage from '../components/PlaceholderPage'

// "예약하기"(ReservationPage, /reservation)와는 다른 페이지: 로그인한 사용자 본인의 지난 예약 목록을 보여준다.
// TODO: booking-service에 내 예약 목록 조회 API가 추가되면 실제 데이터로 교체
function ReservationHistoryPage() {
  return <PlaceholderPage title="내 예약 내역" description="예약 내역 조회 기능은 준비 중입니다." />
}

export default ReservationHistoryPage
