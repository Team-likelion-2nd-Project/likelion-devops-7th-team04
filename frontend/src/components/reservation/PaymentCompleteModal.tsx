import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Payment } from '../../api/payments'
import { CheckIcon } from './icons'
import './PaymentCompleteModal.css'

interface PaymentCompleteModalProps {
  payment: Payment
  onClose: () => void
}

const METHOD_LABELS: Record<string, string> = {
  CARD: '신용·체크카드',
  KAKAOPAY: '카카오페이',
  NAVERPAY: '네이버페이',
  TOSSPAY: '토스페이',
}

// payment.paidAt("2026-08-20T10:00:00.000Z" 등 ISO 문자열)을 "YYYY.MM.DD HH:mm"으로 보여준다.
function formatPaidAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${d} ${hh}:${mm}`
}

/** PaymentModal에서 결제 요청(POST /api/payments)이 성공한 직후 뜨는 결제완료 안내 모달. */
function PaymentCompleteModal({ payment, onClose }: PaymentCompleteModalProps) {
  const navigate = useNavigate()

  // "확인"을 누르면 내 결제 내역 페이지로 보낸다.
  const handleConfirm = () => {
    onClose()
    navigate('/payments')
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    // 확인을 놓치고 바깥을 잘못 눌러 닫히는 걸 막기 위해, 오버레이 클릭으로는 닫지 않는다
    // (닫기는 "확인" 버튼으로만 가능).
    <div className="payment-complete-modal-overlay">
      <div
        className="payment-complete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-complete-modal-title"
      >
        <span className="payment-complete-modal-check" aria-hidden="true">
          <CheckIcon />
        </span>
        <h2 id="payment-complete-modal-title">결제가 완료되었습니다</h2>

        <div className="payment-complete-modal-rows">
          <div className="payment-complete-modal-row">
            <span>승인번호</span>
            <span>{payment.approvalNumber}</span>
          </div>
          <div className="payment-complete-modal-row">
            <span>결제수단</span>
            <span>{METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</span>
          </div>
          <div className="payment-complete-modal-row">
            <span>결제일시</span>
            <span>{formatPaidAt(payment.paidAt)}</span>
          </div>
          <div className="payment-complete-modal-row payment-complete-modal-amount">
            <span>결제금액</span>
            <strong>{payment.amount.toLocaleString()}원</strong>
          </div>
        </div>

        <button type="button" className="payment-complete-modal-confirm" onClick={handleConfirm}>
          확인
        </button>
      </div>
    </div>
  )
}

export default PaymentCompleteModal
