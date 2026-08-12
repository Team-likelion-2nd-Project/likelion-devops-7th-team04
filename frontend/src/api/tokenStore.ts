import { useSyncExternalStore } from 'react'

// 액세스 토큰을 localStorage/sessionStorage가 아닌 메모리(모듈 스코프 변수)에만 보관합니다.
// XSS가 발생해도 스토리지를 뒤져서 토큰을 훔쳐갈 수 없고, 탭을 새로고침하면 사라집니다
// (그래서 앱 부팅 시 refreshToken 쿠키로 /api/auth/refresh를 호출해 재발급받아야 합니다).
let accessToken: string | null = null

export interface UserInfo {
  userId: number
  email: string
  name: string
  role: string
}

// 로그인/재발급 응답에 함께 내려오는 유저 정보(헤더의 "OO님" 표시 등에 사용). 토큰과 마찬가지로
// 메모리에만 두며, 새로고침 시 refreshAccessToken()의 응답으로 다시 채워진다.
let user: UserInfo | null = null

// 토큰/유저 정보가 바뀔 때 리렌더링이 필요한 컴포넌트(예: 헤더의 프로필 메뉴)를 위한 구독자 목록
const listeners = new Set<() => void>()

export function getAccessToken(): string | null {
  return accessToken
}

export function getUser(): UserInfo | null {
  return user
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

// 로그인/토큰 재발급 성공 시 액세스 토큰과 유저 정보를 함께 갱신한다.
export function setAuth(token: string, nextUser: UserInfo): void {
  accessToken = token
  user = nextUser
  notify()
}

export function clearAccessToken(): void {
  accessToken = null
  user = null
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 컴포넌트에서 로그인 여부(액세스 토큰 유무)에 따라 리렌더링하고 싶을 때 사용
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribe, getAccessToken)
}

// 컴포넌트에서 로그인한 유저 정보(이름 등)가 필요할 때 사용
export function useUser(): UserInfo | null {
  return useSyncExternalStore(subscribe, getUser)
}
