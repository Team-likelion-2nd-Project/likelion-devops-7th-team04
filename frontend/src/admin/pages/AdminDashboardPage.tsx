import { Link } from 'react-router-dom'
import './AdminPages.css'

// 예약/결제 서비스(booking-service, payment-service)가 아직 hello 엔드포인트뿐이라 실데이터가 없다.
// 서비스가 준비되면 adminApi.ts에 각 지표를 조회하는 함수를 추가해 value를 실제 값으로 채우면 된다.
const STAT_TILES = [
  { label: '오늘의 체크인 / 체크아웃', value: '— / —' },
  { label: '현재 객실 점유율', value: '—%' },
  { label: '오늘 매출 현황', value: '₩—' },
  { label: '신규 예약 / 취소 건수', value: '— / —' },
]

function AdminDashboardPage() {
  return (
    <section>
      <div className="admin-page-header">
        <h1>대시보드</h1>
        <p>관리자 콘솔에 오신 것을 환영합니다.</p>
      </div>

      <div className="admin-stat-grid">
        {STAT_TILES.map((tile) => (
          <div key={tile.label} className="admin-card admin-stat-tile">
            <span className="admin-stat-label">{tile.label}</span>
            <span className="admin-stat-value">{tile.value}</span>
          </div>
        ))}
      </div>
      <p className="admin-stat-note">※ 예약·결제 서비스 연동 전이라 지표가 아직 집계되지 않습니다.</p>

      <div className="admin-dashboard-grid">
        <Link to="/admin/users" className="admin-card admin-dashboard-card">
          <h2>유저 관리</h2>
          <p>전체 유저 목록 및 상세 정보를 조회합니다.</p>
        </Link>
        <Link to="/admin/hotels" className="admin-card admin-dashboard-card">
          <h2>호텔 관리</h2>
          <p>전체 호텔 목록 및 상세 정보를 조회합니다.</p>
        </Link>
      </div>
    </section>
  )
}

export default AdminDashboardPage
