/**
 * 지원일 표기.
 *
 * 카드에는 연도를 뺀 "8월 1일" 형태로 보이고, 스크린리더와 툴팁에는 연도까지 읽히게 한다.
 * 채용 보드는 최근 지원자를 훑는 화면이라 연도가 카드 폭을 차지할 만큼 중요하지 않지만,
 * 화면에서 지워버리면 연말·연초에 어느 해인지 알 수 없어진다.
 */
const shortFormatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })
const fullFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/**
 * `2026-08-01` 같은 날짜만 있는 문자열을 **로컬 시간대의 그날**로 만든다.
 *
 * `new Date('2026-08-01')`은 명세상 UTC 자정으로 파싱되는데, Intl은 로컬 시간대로 포매팅한다.
 * 그래서 UTC보다 뒤선 지역에서는 하루가 밀린다.
 * 실제로 America/Los_Angeles(UTC-7)에서 `2026-01-01`이 `2025년 12월 31일`로 나왔다 — 연도까지 틀린다.
 *
 * 지원일은 시각이 없는 달력상의 날짜라서 시간대 변환의 대상이 아니다.
 * 연·월·일을 그대로 받아 로컬 날짜로 만든다.
 */
function parseCalendarDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatAppliedDateShort(isoDate: string): string {
  return shortFormatter.format(parseCalendarDate(isoDate))
}

export function formatAppliedDateFull(isoDate: string): string {
  return fullFormatter.format(parseCalendarDate(isoDate))
}
