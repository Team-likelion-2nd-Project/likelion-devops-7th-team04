import { NavLink, Outlet } from 'react-router-dom'
import './AccountLayout.css'

// 마이페이지/예약 내역/결제 내역처럼 "내 정보"에 속한 페이지들이 공유하는 좌측 사이드바.
// 이 그룹 안에서는 메인 페이지를 거치지 않고 서로 바로 이동할 수 있다.
const ACCOUNT_NAV_GROUPS = [
  {
    label: '내정보 관리',
    items: [
      { to: '/mypage', label: '내 정보 수정' },
      { to: '/mypage/password', label: '비밀번호 변경' },
      { to: '/mypage/withdraw', label: '회원탈퇴' },
    ],
  },
  {
    label: '예약 현황',
    items: [{ to: '/reservations', label: '예약내역' }],
  },
  {
    label: '결제',
    items: [
      { to: '/payments/pending', label: '결제대기' },
      { to: '/payments', label: '결제내역' },
    ],
  },
]

function AccountLayout() {
  return (
    <section className="account-layout">
      <aside className="account-sidebar">
        <h1 className="account-sidebar-title">마이페이지</h1>
        <nav aria-label="내 정보 메뉴">
          {ACCOUNT_NAV_GROUPS.map((group) => (
            <div className="account-nav-group" key={group.label}>
              <h2 className="account-nav-group-label">{group.label}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    {/* end를 반드시 줘야 한다: /mypage와 /mypage/password처럼 경로가 겹치는
                        항목들이 있어서, end 없이는 상위 경로(/mypage)가 하위 경로에서도 함께
                        active로 표시된다. */}
                    <NavLink to={item.to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="account-content">
        <Outlet />
      </div>
    </section>
  )
}

export default AccountLayout
