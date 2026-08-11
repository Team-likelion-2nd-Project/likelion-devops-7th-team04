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

function App() {
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
        </Route>
      </Routes>
    </>
  )
}

export default App
