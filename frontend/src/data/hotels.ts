// TODO: 실제 데이터가 준비되면 api-gateway(/api/hotels)에서 가져오도록 교체
export interface Hotel {
  id: string
  name: string
  location: string
  summary: string
  /** 실사진이 준비되기 전까지 카드/히어로에 쓸 플레이스홀더 그라디언트 */
  accent: string
}

export const HOTELS: Hotel[] = [
  {
    id: 'seoul',
    name: '서울점',
    location: '서울 강남구',
    summary: '도심 속에서 누리는 조용한 휴식',
    accent: 'linear-gradient(135deg, #3a3226, #6b5a3d)',
  },
  {
    id: 'busan',
    name: '부산점',
    location: '부산 해운대구',
    summary: '오션뷰와 함께하는 여유로운 시간',
    accent: 'linear-gradient(135deg, #24343a, #3d6b6a)',
  },
  {
    id: 'jeju',
    name: '제주점',
    location: '제주 서귀포시',
    summary: '자연 속 프라이빗한 힐링 스테이',
    accent: 'linear-gradient(135deg, #2f3a26, #5a6b3d)',
  },
]
