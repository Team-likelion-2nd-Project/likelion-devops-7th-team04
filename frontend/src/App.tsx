import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import RootLayout from './layouts/RootLayout'
import MainPage from './pages/MainPage'
import PhilosophyPage from './pages/PhilosophyPage'
import HotelsPage from './pages/HotelsPage'
import HotelDetailPage from './pages/HotelDetailPage'
import NoticesPage from './pages/NoticesPage'
import ReservationPage from './pages/ReservationPage'
import MyPage from './pages/MyPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import { refreshAccessToken } from './api/gateway'

// 고객 프론트와 완전히 독립된 관리자 화면. 별도 청크로 code splitting되도록 lazy import한다.
const AdminApp = lazy(() => import('./admin/AdminApp'))

function App() {
  useEffect(() => {
    // 액세스 토큰은 메모리에만 두므로 새로고침하면 사라진다. httpOnly 리프레시 토큰 쿠키가
    // 남아있다면 앱 부팅 시 조용히 재발급받아 로그인 상태를 복구한다 (없거나 만료됐으면 그냥 비로그인 상태).
    refreshAccessToken().catch(() => {})
  }, [])

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<MainPage />} />
          <Route path="philosophy/:slug" element={<PhilosophyPage />} />
          <Route path="hotels" element={<HotelsPage />} />
          <Route path="hotels/:hotelId" element={<HotelDetailPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="reservation" element={<ReservationPage />} />
          <Route path="mypage" element={<MyPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
        </Route>

        {/* RootLayout 바깥의 형제 라우트: 고객용 Header/Footer/MobileDock을 렌더링하지 않는
            완전히 독립된 레이아웃 + 별도 라우트 네임스페이스(/admin/*)를 갖는다. */}
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={null}>
              <AdminApp />
            </Suspense>
          }
        />
      </Routes>
    </>
  )
}

export default App
