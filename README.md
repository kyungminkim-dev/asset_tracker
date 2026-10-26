# 자산 트래커

여러 증권사에 흩어진 주식 자산을 한곳에 모아, 기간별(1주~전체) 변화를 보여주는 모바일 앱.

```
mobile/   Expo (React Native) 앱 — 대시보드, 보유 종목, 증권사 연결
server/   Node + Fastify + SQLite — 증권사 API 연동, 매일 스냅샷 저장
```

## 구조

```
[모바일 앱] ──(APP_TOKEN)──▶ [내 서버] ──▶ 한국투자증권 / 토스증권 / ... API
                                │
                                └─ SQLite: 연결(키 암호화), 일별 스냅샷
```

- **API 키는 서버에만** AES-256-GCM 으로 암호화되어 저장됩니다. 앱에는 남지 않아요.
- 서버가 **매일 16:10(KST)** 에 모든 증권사 잔고를 조회해 스냅샷을 남깁니다. 앱의 "지금 동기화" 버튼으로도 실행할 수 있어요.
- 해외 주식은 그날 환율(ECB 기준, Frankfurter)로 원화 환산합니다.
- 어떤 증권사 동기화가 실패하면 직전 값을 이어붙여서 그래프가 갑자기 꺼지지 않게 합니다. 이렇게 채운 종목은 "이전 데이터"로 표시돼요.

## 지원 증권사

| 증권사 | 방식 | 비고 |
|---|---|---|
| 한국투자증권 | API | 국내 + 해외(미국/홍콩/중국/일본/베트남), 실전/모의 |
| 토스증권 | API | 2026-08 정식 오픈한 Open API. 예수금은 아직 미지원 |
| 그 외 | 직접 입력 | API가 없는 증권사는 종목을 직접 입력 |

### 새 증권사 추가하기

1. `server/src/brokers/_template.ts` 를 복사해 `server/src/brokers/<증권사>.ts` 로 만듭니다.
2. `credentialFields` 와 `fetchAccounts()` 를 구현합니다.
3. `server/src/brokers/registry.ts` 에 등록합니다.

앱은 서버의 `/api/brokers` 를 보고 연결 폼을 자동으로 그리기 때문에, **앱은 수정하지 않아도 됩니다.**

## 실행

### 서버

```bash
cd server
npm install
cp .env.example .env
npm run gen-key        # 출력값을 .env 의 ENCRYPTION_KEY 에
# .env 의 APP_TOKEN 도 긴 랜덤 문자열로 바꾸기
npm run dev
```

토스증권처럼 **허용 IP** 를 요구하는 증권사는 이 서버의 공인 IP를 등록해야 합니다.

### 앱

```bash
cd mobile
npm install
npx expo start
```

앱을 연 뒤 ⚙︎ 설정에서 서버 주소(예: `http://192.168.0.10:4000`)와 APP_TOKEN 을 입력합니다.
실제 폰에서는 서버와 같은 Wi-Fi에 있거나, 외부에서 접근할 수 있는 주소가 필요해요.

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/brokers` | 지원 증권사와 입력 필드 |
| GET/POST/DELETE | `/api/connections` | 증권사 연결 (POST 때 실제 조회로 키를 검증) |
| GET/PUT/DELETE | `/api/connections/:id/manual-positions` | 직접 입력 종목 |
| POST | `/api/sync` | 지금 동기화 |
| GET | `/api/portfolio/summary?range=1M` | 총자산, 기간 변화, 비중, 종목별 손익 |
| GET | `/api/portfolio/history?range=1Y` | 일별 총자산 추이 |
