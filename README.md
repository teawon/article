# 아티클 오디오 (긱뉴스)

긱뉴스 아티클을 **운전 중 들어도 흐름을 놓치지 않는 한국어 낭독**으로 바꿔,
브라우저(Web Speech API)로 듣는 개인용 프로젝트.

## 한눈에 보는 구조

```
수집(collect)        → 가공(narrate)            → 소비(web)
긱뉴스 주간호/RSS    → 운전용 대본으로 재작성    → React 앱에서 유나 음성 재생
data/raw/<key>.json    data/narrated/<key>.json    import.meta.glob 로 로드
```

- **수집과 소비는 브라우저 밖(Node)**: CORS 때문에 수집은 스크립트로 하고, 웹앱은 결과(`data/narrated`)만 읽는다.
- **원문 캐시(raw)와 산출물(narrated) 분리**: raw 는 재생성 가능하므로 `.gitignore`, narrated 는 커밋한다.
- **식별 키** = `"<provider-slug>__<소스ID 또는 URL해시>"` (예: `geeknews__31806`). 제목은 절대 중복 기준으로 쓰지 않는다.
- **`data/seen.json`**: 한 번이라도 수집한 키 장부(append-only). 오래된 파일을 지워도 다시 등록되지 않게 막는다.

## 매주 하는 일 — 스킬 하나로

Claude Code 세션에서 **`weekly-update` 스킬**을 실행하면 다음이 순서대로 이어진다.

```
weekly-update 실행
  1. 수집   node scripts/collect-weekly.mjs      → 그 주 주간호 토픽을 data/raw 에 저장
  2. 보정   (article-narration 규칙 적용)         → data/narrated 에 운전용 대본 생성
  3. 배포   커밋 & push(확인 후)                   → Vercel 자동 배포
```

- 보정은 사람(Claude Code)이 수행하며, 주간호가 30개 이상이면 **여러 배치로 나눠** 처리한다. 중단해도 "보정 대기"(raw 있으나 narrated 없는 키)만 다시 이어가면 된다.
- 즉 **완전 무인 cron 이 아니라, 스킬을 실행하면 수집→배치 보정→배포까지 자동으로 이어지는** 방식이다. 무인 자동화로 가려면 2번 보정을 Claude API 호출로 바꾸면 된다.

### 미리보기 / 특정 주차
```bash
node scripts/collect-weekly.mjs --dry        # 이번 주 주간호 토픽 목록만 확인 (수집 안 함)
node scripts/collect-weekly.mjs 202629        # 특정 주차 수집
```

### 특정 글만 추가
주간호가 아니라 개별 글을 넣고 싶으면, 해당 `topic?id=...` 링크를 주면 같은 키 규칙으로 수집·보정한다.

## 스크립트

| 명령 | 하는 일 |
|------|---------|
| `node scripts/collect-weekly.mjs [주차] [--dry]` | 긱뉴스 주간호(엄선 이슈) 수집. 기본은 최신호 |
| `node scripts/collect.mjs [개수]` | 긱뉴스 RSS 최신 N개 수집(주제 무관) |
| `scripts/lib.mjs` | 수집 공용 로직(키/정규화/본문추출/seen/보정대기) |

## 스킬 (`.claude/skills/`)

- **`weekly-update`** — 수집 → 보정 → 커밋·배포 오케스트레이션 (매주 실행)
- **`article-narration`** — 원문을 운전용 대본으로 재작성하는 규칙. 낭독 톤을 바꾸려면 이 파일만 수정한다.

## 웹앱 (React + Vite + TS)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (Vercel 배포용)
```

- `data/narrated/*.json` 을 빌드 시점에 로드 → 소스 탭 / 게시일 / 상세 화면
- 상세: 전체 텍스트 + 현재 문장 하이라이트, 하단 고정 재생바(문장 이전·다음/정지/AI질의 자리), 이전 글·다음 글
- 좋아요(♥)·읽음 상태는 `localStorage` 에 저장. 목록에서 전체 / 안읽음 / 좋아요 로 필터하고, 읽은 글은 흐리게 + "읽음" 표시
- 주제 태그(AI·프론트엔드·도구 등)를 뱃지로 표기하고 태그별 필터 제공. 태그는 article-narration 스킬이 분류
- 재생은 브라우저 음성 합성(Web Speech API). 화면을 켜 둔 상태에서 동작하며, 배경 재생이 필요하면 mp3+팟캐스트 방식으로 확장 가능.

## 데이터 흐름 요약

```
data/
├── raw/<key>.json        # 수집 원문 (gitignore, 재생성 가능)
├── narrated/<key>.json   # 낭독 대본 (커밋, 웹앱이 읽음)
└── seen.json             # 수집 장부 (커밋, 중복·부활 방지)
```
