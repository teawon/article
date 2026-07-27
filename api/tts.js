// Vercel 서버리스 함수: 대본 텍스트 → 엣지(마이크로소프트) 신경망 음성 + 단어 타이밍
// 무료, API 키 불필요. POST { text, voice } → { audio(base64 mp3), boundaries }
import { EdgeTTS } from '@andresaya/edge-tts'

export const config = { maxDuration: 60 }

const ALLOWED = new Set([
  'ko-KR-SunHiNeural',
  'ko-KR-InJoonNeural',
  'ko-KR-HyunsuMultilingualNeural',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  try {
    const { text, voice } = req.body || {}
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text required' })
      return
    }
    const chosen = ALLOWED.has(voice) ? voice : 'ko-KR-SunHiNeural'
    const tts = new EdgeTTS()
    await tts.synthesize(text, chosen, { rate: '0%', pitch: '0Hz', volume: '0%' })

    const audio = tts.toBase64()
    // 단어 타이밍: offset 은 100ns 틱 → 초 = offset / 1e7
    const boundaries = (tts.getWordBoundaries() || []).map((w) => ({
      t: w.offset / 1e7,
      text: w.text,
    }))

    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).json({ audio, boundaries })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
