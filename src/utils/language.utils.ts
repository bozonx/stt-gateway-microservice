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
  
  // If it's already a 2-letter code, return it
  if (cleaned.length === 2) return cleaned
  
  // If it's a locale code like 'ru-RU' or 'en-US', extract the language part
  if (cleaned.includes('-')) {
    const languagePart = cleaned.split('-')[0]
    if (languagePart.length === 2) return languagePart
  }
  
  // Try to map full language name to code
  return LANGUAGE_MAP[cleaned] || cleaned
}
