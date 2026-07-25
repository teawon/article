---
name: weekly-update
description: 긱뉴스 주간호(엄선된 그 주의 이슈)를 수집→운전용 대본 보정→커밋·배포까지 한 번에 처리한다. 매주 월요일 "주간 업데이트 해줘", "weekly-update", "이번 주 긱뉴스 가져와줘" 등으로 실행. 긱뉴스 주간호는 이미 큐레이션되어 있으므로 FE/AI 필터링은 하지 않는다.
---

# 주간 업데이트 스킬 (긱뉴스 weekly)

매주 월요일 발행되는 긱뉴스 주간호(`https://news.hada.io/weekly`)를 통째로 가져와,
각 토픽을 운전 중 청취용 대본으로 만들고, 커밋·배포까지 한 번에 처리한다.

> 주간호는 긱뉴스가 그 주의 큰 이슈를 이미 엄선한 묶음이다. 별도 주제 필터(FE/AI 등)는 적용하지 않는다.

## 실행 절차

### 1. 미리보기 (선택)
```
node scripts/collect-weekly.mjs --dry
```
이번 주간호 제목과 토픽 목록을 사용자에게 보여준다. 사용자가 특정 주차를 원하면 `--dry 202629` 처럼 주차를 넘긴다.

### 2. 수집
```
node scripts/collect-weekly.mjs          # 최신호 (특정 주차는 뒤에 202629 처럼)
```
- 각 토픽의 본문(`#topic_contents`)을 추출해 `data/raw/<key>.json` 생성
- 이미 `data/seen.json` 에 있는 토픽은 자동 스킵 (중복·부활 방지)
- 끝에 "보정 대기" 목록(= raw 있으나 narrated 없는 키)을 출력한다

### 3. 보정 (article-narration 규칙 적용)
- **보정 대기 키 전부**에 대해, [[article-narration]] 스킬의 "대본 작성 규칙"을 그대로 적용해
  `data/narrated/<key>.json` 을 만든다. (원문 필드 유지 + `paragraphs`→`script`)
- ⚠️ 주간호는 30개 이상일 수 있다. 한 번에 다 하기 버거우면 **여러 배치로 나눠** 진행하되,
  중간에 멈추면 남은 "보정 대기"를 사용자에게 알린다. (raw/narrated 폴더 비교로 언제든 재개 가능)
- 완료 후 검증: `npx tsc -b && npm run build` 가 통과하는지 확인.

### 4. 커밋 & 배포
- `data/narrated/*.json` 과 `data/seen.json` 을 커밋한다. (`data/raw/` 는 gitignore 대상)
- 커밋 메시지 예: `content: {주차} 주간호 N개 추가`
- **push 는 사용자에게 확인받은 뒤** 실행한다. push 하면 Vercel 이 자동 배포한다.

## 보고 형식
마지막에 사용자에게 요약한다: 이번 주간호 제목, 수집/보정한 개수, (있다면) 남은 보정 대기, 배포 여부.

## 참고
- 완전 무인 자동화(cron)로 가려면 3번 보정을 Claude API 호출로 바꿔야 한다. 현재는 사용자가 이 스킬을 실행해 사람(Claude Code)이 보정한다.
- 특정 글만 추가하고 싶으면 이 스킬 대신 해당 topic 링크를 직접 주면 된다 (collect 없이 그 URL의 본문을 추출해 같은 키 규칙으로 저장).
