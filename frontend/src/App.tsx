import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import RootLayout from './layouts/RootLayout'
import HotelLayout from './layouts/HotelLayout'
import MainPage from './pages/MainPage'
import PhilosophyPage from './pages/PhilosophyPage'
import HotelsPage from './pages/HotelsPage'
import HotelDetailPage from './pages/HotelDetailPage'
import HotelStayPage from './pages/HotelStayPage'
import RoomDetailPage from './pages/RoomDetailPage'
import HotelWatersPage from './pages/HotelWatersPage'
import NoticesPage from './pages/NoticesPage'
import ReservationPage from './pages/ReservationPage'
import MyPage from './pages/MyPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import { refreshAccessToken } from './api/gateway'

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
          <Route path="hotels/:hotelId" element={<HotelLayout />}>
            <Route index element={<HotelDetailPage />} />
            <Route path="stay" element={<HotelStayPage />} />
            <Route path="rooms/:roomId" element={<RoomDetailPage />} />
            <Route path="waters" element={<HotelWatersPage />} />
          </Route>
          <Route path="notices" element={<NoticesPage />} />
          <Route path="reservation" element={<ReservationPage />} />
          <Route path="mypage" element={<MyPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
