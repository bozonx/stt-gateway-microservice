export const LANGUAGE_MAP: Record<string, string> = {
  russian: 'ru',
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  dutch: 'nl',
  polish: 'pl',
  turkish: 'tr',
  ukrainian: 'uk',
  swedish: 'sv',
  finnish: 'fi',
  norwegian: 'no',
  danish: 'da',
  czech: 'cs',
  greek: 'el',
  hebrew: 'he',
  arabic: 'ar',
  hindi: 'hi',
  japanese: 'ja',
  chinese: 'zh',
  korean: 'ko',
  indonesian: 'id',
  vietnamese: 'vi',
  thai: 'th',
}

export function normalizeLanguageCode(input?: string): string | undefined {
  if (!input) return undefined
  const cleaned = input.trim().toLowerCase()
  if (cleaned.length === 2) return cleaned
  return LANGUAGE_MAP[cleaned] || cleaned
}
