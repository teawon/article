import { useEffect, useRef, useState } from 'react'
import { articles, type Article } from './articles'

/** 긴 텍스트는 문장 단위로 끊어 읽어야 브라우저(특히 Safari)가 중간에 멈추지 않는다. */
function splitIntoChunks(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function App() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState<string>('')
  const [rate, setRate] = useState(1)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  // 현재 재생을 취소하기 위한 토큰. speak 할 때마다 증가시켜 이전 큐를 무효화한다.
  const runToken = useRef(0)

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // 사용 가능한 음성 로딩 (voiceschanged 이벤트로 비동기 도착)
  useEffect(() => {
    if (!supported) return
    const load = () => {
      const all = window.speechSynthesis.getVoices()
      const korean = all.filter((v) => v.lang.toLowerCase().startsWith('ko'))
      setVoices(korean.length ? korean : all)
      setVoiceURI((prev) => {
        if (prev) return prev
        const preferred = korean[0] ?? all[0]
        return preferred ? preferred.voiceURI : ''
      })
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  const stop = () => {
    runToken.current++
    window.speechSynthesis.cancel()
    setPlayingId(null)
    setPaused(false)
  }

  const speak = (article: Article) => {
    if (!supported) return
    // 항상 깨끗한 상태에서 시작
    window.speechSynthesis.cancel()
    const token = ++runToken.current
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null
    const chunks = splitIntoChunks(article.script)

    setPlayingId(article.id)
    setPaused(false)

    const speakChunk = (i: number) => {
      if (token !== runToken.current) return // 취소됨
      if (i >= chunks.length) {
        setPlayingId(null)
        return
      }
      const u = new SpeechSynthesisUtterance(chunks[i])
      if (voice) u.voice = voice
      u.lang = voice?.lang ?? 'ko-KR'
      u.rate = rate
      u.onend = () => speakChunk(i + 1)
      u.onerror = () => {
        if (token === runToken.current) setPlayingId(null)
      }
      window.speechSynthesis.speak(u)
    }
    speakChunk(0)
  }

  const togglePause = () => {
    if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
    } else {
      window.speechSynthesis.pause()
      setPaused(true)
    }
  }

  if (!supported) {
    return (
      <main className="wrap">
        <h1>긱뉴스 오디오</h1>
        <p className="warn">
          이 브라우저는 음성 합성(Web Speech API)을 지원하지 않아요. 크롬이나 Safari에서 열어 주세요.
        </p>
      </main>
    )
  }

  return (
    <main className="wrap">
      <header>
        <h1>긱뉴스 오디오 <span className="badge">테스트</span></h1>
        <p className="sub">브라우저가 직접 읽어주는 방식 — mp3 파일 없이 재생합니다.</p>
      </header>

      <section className="controls">
        <label>
          음성
          <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        <label>
          속도 <strong>{rate.toFixed(1)}x</strong>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
      </section>

      <ul className="list">
        {articles.map((a) => {
          const active = playingId === a.id
          return (
            <li key={a.id} className={active ? 'card active' : 'card'}>
              <div className="meta">
                <h2>{a.title}</h2>
                <a href={a.link} target="_blank" rel="noreferrer">
                  {a.source}
                </a>
              </div>
              <div className="actions">
                {active ? (
                  <>
                    <button onClick={togglePause}>{paused ? '▶ 계속' : '⏸ 일시정지'}</button>
                    <button className="ghost" onClick={stop}>■ 정지</button>
                  </>
                ) : (
                  <button onClick={() => speak(a)}>▶ 듣기</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <footer>
        <p className="note">
          ※ 이 화면을 켜 둔 상태에서만 재생됩니다. 화면을 끄면(특히 iOS) 멈출 수 있어요 —
          출퇴근 배경 재생이 필요하면 팟캐스트(mp3) 방식이 안정적입니다.
        </p>
      </footer>
    </main>
  )
}
