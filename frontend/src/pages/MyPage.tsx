import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  changePassword,
  fetchMe,
  logout,
  refreshAccessToken,
  updateMe,
  withdrawMe,
  type UserProfile,
} from '../api/gateway'
import './MyPage.css'

function MyPage() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 정보 수정 폼
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhoneNumber, setEditPhoneNumber] = useState('')
  const [editError, setEditError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 비밀번호 변경 폼
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPasswordSubmitting, setIsChangingPasswordSubmitting] = useState(false)

  // 회원 탈퇴
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [isWithdrawSubmitting, setIsWithdrawSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const data = await fetchMe()
        if (!cancelled) setProfile(data)
      } catch {
        // 새로고침 직후에는 액세스 토큰이 메모리에서 아직 복구되지 않았을 수 있으니
        // 리프레시 토큰(쿠키)으로 한 번 재발급을 시도한 뒤 다시 조회한다.
        try {
          await refreshAccessToken()
          const data = await fetchMe()
          if (!cancelled) setProfile(data)
        } catch {
          if (!cancelled) navigate('/login')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const startEditing = () => {
    if (!profile) return
    setEditName(profile.name)
    setEditPhoneNumber(profile.phoneNumber)
    setEditError('')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditError('')
  }

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEditError('')
    setIsSaving(true)
    try {
      const updated = await updateMe({ name: editName, phoneNumber: editPhoneNumber })
      setProfile(updated)
      setIsEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '정보 수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const startChangingPassword = () => {
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirm('')
    setPasswordError('')
    setIsChangingPassword(true)
  }

  const cancelChangingPassword = () => {
    setIsChangingPassword(false)
    setPasswordError('')
  }

  const handlePasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPasswordError('')

    // 서버 요청 전에 확인 가능한 것만 클라이언트에서 먼저 걸러낸다 (비밀번호 확인, 최소 길이).
    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setIsChangingPasswordSubmitting(true)
    try {
      await changePassword({ currentPassword, newPassword })
      // 비밀번호 변경 시 서버가 모든 세션(리프레시 토큰)을 무효화하므로, 클라이언트도 함께 로그아웃하고
      // 새 비밀번호로 다시 로그인하도록 안내한다.
      await logout()
      navigate('/login', { state: { message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.' } })
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setIsChangingPasswordSubmitting(false)
    }
  }

  const startWithdrawing = () => {
    setWithdrawError('')
    setIsWithdrawing(true)
  }

  const cancelWithdrawing = () => {
    setIsWithdrawing(false)
    setWithdrawError('')
  }

  const handleWithdraw = async () => {
    setWithdrawError('')
    setIsWithdrawSubmitting(true)
    try {
      await withdrawMe()
      navigate('/login', { state: { message: '회원 탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.' } })
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : '회원 탈퇴에 실패했습니다.')
    } finally {
      setIsWithdrawSubmitting(false)
    }
  }

  return (
    <section className="mypage-page">
      <div className="mypage-card">
        <h1 className="mypage-title">마이페이지</h1>
        <p className="mypage-description">내 정보를 확인하고 수정할 수 있습니다.</p>

        {isLoading && <p className="mypage-status">불러오는 중...</p>}

        {!isLoading && profile && (
          <>
            <div className="mypage-section">
              <div className="mypage-section-header">
                <h2>내 정보</h2>
                {!isEditing && (
                  <button type="button" className="mypage-ghost-btn" onClick={startEditing}>
                    내 정보 수정
                  </button>
                )}
              </div>

              {!isEditing ? (
                <dl className="mypage-info-list">
                  <div className="mypage-info-row">
                    <dt>이메일</dt>
                    <dd>{profile.email}</dd>
                  </div>
                  <div className="mypage-info-row">
                    <dt>이름</dt>
                    <dd>{profile.name}</dd>
                  </div>
                  <div className="mypage-info-row">
                    <dt>휴대폰 번호</dt>
                    <dd>{profile.phoneNumber}</dd>
                  </div>
                </dl>
              ) : (
                <form className="mypage-form" onSubmit={handleEditSubmit} noValidate>
                  <label className="mypage-field">
                    <span>이름</span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </label>

                  <label className="mypage-field">
                    <span>휴대폰 번호</span>
                    <input
                      type="tel"
                      name="phoneNumber"
                      autoComplete="tel"
                      placeholder="010-1234-5678"
                      value={editPhoneNumber}
                      onChange={(e) => setEditPhoneNumber(e.target.value)}
                      required
                    />
                  </label>

                  {editError && <p className="mypage-error">{editError}</p>}

                  <div className="mypage-actions">
                    <button
                      type="button"
                      className="mypage-ghost-btn"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      취소
                    </button>
                    <button type="submit" className="mypage-submit" disabled={isSaving}>
                      {isSaving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mypage-divider" />

            <div className="mypage-section">
              <div className="mypage-section-header">
                <h2>비밀번호</h2>
                {!isChangingPassword && (
                  <button type="button" className="mypage-ghost-btn" onClick={startChangingPassword}>
                    비밀번호 변경
                  </button>
                )}
              </div>

              {isChangingPassword && (
                <form className="mypage-form" onSubmit={handlePasswordSubmit} noValidate>
                  <label className="mypage-field">
                    <span>현재 비밀번호</span>
                    <input
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </label>

                  <label className="mypage-field">
                    <span>새 비밀번호</span>
                    <input
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </label>

                  <label className="mypage-field">
                    <span>새 비밀번호 확인</span>
                    <input
                      type="password"
                      name="newPasswordConfirm"
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      required
                    />
                  </label>

                  {passwordError && <p className="mypage-error">{passwordError}</p>}

                  <p className="mypage-hint">비밀번호를 변경하면 자동으로 로그아웃되며, 새 비밀번호로 다시 로그인해야 합니다.</p>

                  <div className="mypage-actions">
                    <button
                      type="button"
                      className="mypage-ghost-btn"
                      onClick={cancelChangingPassword}
                      disabled={isChangingPasswordSubmitting}
                    >
                      취소
                    </button>
                    <button type="submit" className="mypage-submit" disabled={isChangingPasswordSubmitting}>
                      {isChangingPasswordSubmitting ? '변경 중...' : '비밀번호 변경'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mypage-divider" />

            <div className="mypage-section">
              <div className="mypage-section-header">
                <h2>회원 탈퇴</h2>
                <button type="button" className="mypage-ghost-btn" onClick={startWithdrawing}>
                  회원 탈퇴
                </button>
              </div>
              <p className="mypage-hint">계정을 삭제하면 되돌릴 수 없습니다.</p>
            </div>
          </>
        )}
      </div>

      {isWithdrawing && (
        <div className="mypage-modal-overlay" onClick={cancelWithdrawing}>
          <div
            className="mypage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="withdraw-modal-title">정말 탈퇴하시겠어요?</h2>
            <p className="mypage-warning">
              탈퇴 시 계정 정보가 즉시 삭제되며 되돌릴 수 없습니다. 그동안의 예약 내역 등도 더 이상 조회할 수 없습니다.
            </p>

            {withdrawError && <p className="mypage-error">{withdrawError}</p>}

            <div className="mypage-actions">
              <button
                type="button"
                className="mypage-ghost-btn"
                onClick={cancelWithdrawing}
                disabled={isWithdrawSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="mypage-danger-btn"
                onClick={handleWithdraw}
                disabled={isWithdrawSubmitting}
              >
                {isWithdrawSubmitting ? '탈퇴 처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default MyPage
