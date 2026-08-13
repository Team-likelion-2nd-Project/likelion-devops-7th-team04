import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { refreshAccessToken } from '../api/gateway'
import { getAccessToken, useAccessToken, useUser } from '../api/tokenStore'

// 관리자 라우트 전용 클라이언트 라우트가드 (UX용). 실제 접근 제어는 서버의
// RolesGuard(@Roles('ADMIN'))가 담당하며, 이 가드는 권한 없는 사용자가 관리자 화면을
// 잠깐이라도 보지 않도록 UI 레벨에서 미리 걸러주는 역할만 한다.
function AdminGuard() {
  const accessToken = useAccessToken()
  const user = useUser()
  const location = useLocation()
  // 마운트 시점에 이미 액세스 토큰이 있으면 재발급을 시도할 필요가 없다.
  const [checked, setChecked] = useState(() => Boolean(getAccessToken()))

  useEffect(() => {
    if (checked) return

    let cancelled = false
    // 새로고침 등으로 /admin/* 경로에 직접 진입하면 메모리의 액세스 토큰이 비어있을 수 있다.
    // httpOnly 리프레시 토큰 쿠키가 남아있다면 조용히 재발급받아 세션을 복구해본다.
    refreshAccessToken()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [checked])

  if (!checked) {
    return <div className="admin-guard-checking">확인 중...</div>
  }

  if (!accessToken || user?.role !== 'ADMIN') {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export default AdminGuard
