# 자산 트래커

여러 증권사에 흩어진 주식 자산을 한곳에 모아, 기간별(1주~전체) 변화를 보여주는 모바일 앱.

```
mobile/   Expo (React Native) 앱 — 로그인, 대시보드, 보유 종목, 증권사 연결
server/   Node + Fastify + SQLite — 소셜 로그인, 증권사 API 연동, 매일 스냅샷 저장
```

## 구조

```
[모바일 앱] ──(로그인 세션)──▶ [내 서버] ──▶ 한국투자증권 / 토스증권 / ... API
                                  │
                                  └─ SQLite: 회원, 증권사 연결(키 암호화), 사용자별 일별 스냅샷
```

- **회원가입/로그인**은 구글, 카카오 OAuth 로 합니다. 처음 로그인하면 자동으로 가입돼요.
- **API 키는 서버에만** AES-256-GCM 으로 암호화되어 저장됩니다. 앱에는 남지 않아요.
- 증권사 연결, 자산 기록은 **사용자별로 분리**되어 다른 사람의 데이터에 접근할 수 없습니다.
- 서버가 **매일 16:10(KST)** 에 모든 사용자의 잔고를 조회해 스냅샷을 남깁니다. 앱의 "지금 동기화" 버튼으로도 실행할 수 있어요.
- 해외 주식은 그날 환율(ECB 기준, Frankfurter)로 원화 환산합니다.
- 어떤 증권사 동기화가 실패하면 직전 값을 이어붙여서 그래프가 갑자기 꺼지지 않게 합니다. 이렇게 채운 종목은 "이전 데이터"로 표시돼요.

## 로그인 흐름

```
앱 ──① 브라우저 열기 (challenge)──▶ 서버 /auth/{provider}/start ──302──▶ 구글/카카오 로그인
                                                                         │ ② 인가 코드
앱 ◀──③ assettracker://auth?code=1회용코드 ── 서버 /auth/{provider}/callback ◀┘
 └──④ POST /auth/exchange (1회용코드 + verifier) ──▶ 세션 토큰 발급
```

- client secret 은 서버에만 있습니다.
- 앱이 만든 verifier 의 해시(challenge)를 처음에 보내고, 마지막에 verifier 원본으로 확인합니다.
  딥링크를 다른 앱이 가로채도 verifier 없이는 로그인할 수 없어요.
- state, 1회용 코드는 모두 한 번만 쓸 수 있고 짧게 만료됩니다(10분 / 2분). 세션 토큰은 해시만 DB에 저장합니다.
- 계정은 `(제공자, 제공자 사용자 ID)` 로 구분합니다. 같은 이메일이라도 구글과 카카오 계정을 자동으로 합치지 않아요.

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

### 1. 서버 주소 정하기 (`PUBLIC_URL`)

로그인 후 구글/카카오가 서버로 돌아와야 하므로, 폰과 구글/카카오가 모두 접근할 수 있는 주소가 필요합니다.
구글은 `https` (또는 `localhost`) 만 허용해요. 개발 중에는 터널을 쓰면 편합니다.

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:4000   # 출력되는 https://xxxx.trycloudflare.com 이 PUBLIC_URL
```

### 2. 구글 로그인 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → **OAuth 동의 화면** 설정
2. **사용자 인증 정보 → OAuth 클라이언트 ID 만들기**, 유형 **웹 애플리케이션**
3. 승인된 리디렉션 URI: `{PUBLIC_URL}/auth/google/callback`
4. 클라이언트 ID / 보안 비밀을 `.env` 의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 에

### 3. 카카오 로그인 키 발급

1. [Kakao Developers](https://developers.kakao.com/) → 내 애플리케이션 → 애플리케이션 추가
2. **카카오 로그인** 활성화, Redirect URI: `{PUBLIC_URL}/auth/kakao/callback`
3. **동의항목**에서 닉네임/프로필 사진 설정 (이메일은 선택. 비즈 앱 전환이 필요할 수 있어요)
4. 앱 키의 **REST API 키** → `KAKAO_REST_API_KEY`, 보안 → **Client Secret** → `KAKAO_CLIENT_SECRET`

키를 넣은 제공자만 로그인 화면에 나타납니다.

### 4. 서버 실행

```bash
cd server
npm install
cp .env.example .env   # PUBLIC_URL, 구글/카카오 키 입력
npm run gen-key        # 출력값을 .env 의 ENCRYPTION_KEY 에
npm run dev
```

토스증권처럼 **허용 IP** 를 요구하는 증권사는 이 서버의 공인 IP를 등록해야 합니다.

> 회원 기능 이전에 만든 DB(`data/asset-tracker.db`)는 구조가 달라 서버가 시작되지 않습니다. 지우고 다시 실행하세요.

### 5. 앱 실행

```bash
cd mobile
npm install
npx expo start
```

로그인 화면 아래 **서버 설정**에서 `PUBLIC_URL` 을 입력한 뒤 구글/카카오로 로그인합니다.
Expo Go 에서는 `exp://` 주소로 돌아오므로 서버 `.env` 의 `APP_REDIRECT_PREFIXES` 에 `exp://` 가 있어야 합니다(기본값).
**배포할 때는 `exp://` 를 빼세요.**

### 약관 · 개인정보 처리방침

원문은 `server/legal/*.md` 이고, 서버가 웹 페이지로 공개합니다 (로그인 불필요).

| 문서 | 주소 |
|---|---|
| 서비스 이용약관 | `{PUBLIC_URL}/legal/terms` |
| 개인정보 수집·이용 동의 | `{PUBLIC_URL}/legal/consent` |
| 개인정보 처리방침 | `{PUBLIC_URL}/legal/privacy` — 앱스토어·구글/카카오 로그인 설정의 "개인정보 처리방침 URL" |

운영자, 연락처, 서버 위치 등은 `.env` 의 `LEGAL_*` 값으로 채워집니다. 비어 있으면 문서에 노란색으로 표시되고 "초안" 안내가 붙어요.
**초안이므로 공개 전에 법률 검토를 받으세요.** 특히 불특정 다수에게 서비스한다면 신용정보법상 마이데이터(본인신용정보관리업) 해당 여부와 각 증권사 Open API 약관을 확인해야 합니다.

### 종목 뉴스

뉴스 탭은 보유 종목의 뉴스를 보여줍니다. 출처는 서버 `.env` 에 따라 정해져요.

| 설정 | 출처 | 비고 |
|---|---|---|
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 있음 | 네이버 검색 API (뉴스) | 공식 API, 하루 25,000회 무료. 네이버 개발자센터에서 "검색" API 로 애플리케이션 등록 |
| 없음 (기본) | Google 뉴스 RSS | 키 불필요. **개인·비상업적 용도로만** 허용되므로 공개 서비스에는 네이버 키를 넣으세요 |

같은 검색어는 서버가 10분 동안 캐시하고, 보유하지 않은 종목은 검색하지 않습니다.

### 앱스토어 배포 전 확인

- iOS 앱이 구글/카카오 같은 외부 로그인을 제공하면 App Store 심사 지침(4.8)상 **Sign in with Apple** 같은 개인정보 보호형 로그인도 함께 제공해야 할 수 있습니다.
- 계정을 만들 수 있는 앱은 **앱 안에서 회원 탈퇴**가 가능해야 합니다. (설정 → 회원 탈퇴로 구현됨)

## API

로그인 없이:

| Method | Path | 설명 |
|---|---|---|
| GET | `/auth/providers` | 사용 가능한 로그인 방식 |
| GET | `/auth/:provider/start?redirect_uri=&challenge=` | 로그인 시작 (브라우저로 연다) |
| GET | `/auth/:provider/callback` | 구글/카카오 콜백 |
| POST | `/auth/exchange` | 1회용 코드 + verifier → 세션 토큰 |
| POST | `/auth/poll` | verifier 로 로그인 완료 여부 확인 (딥링크로 못 돌아오는 환경용) |
| GET | `/legal/:doc` | 약관 문서 (terms, consent, privacy) |

로그인 필요 (`Authorization: Bearer {세션 토큰}`):

| Method | Path | 설명 |
|---|---|---|
| GET / DELETE | `/api/me` | 내 정보 / 회원 탈퇴 (모든 데이터 삭제) |
| POST | `/api/logout` | 로그아웃 (세션 폐기) |
| GET | `/api/brokers` | 지원 증권사와 입력 필드 |
| GET/POST/DELETE | `/api/connections` | 증권사 연결 (POST 때 실제 조회로 키를 검증) |
| GET/PUT/DELETE | `/api/connections/:id/manual-positions` | 직접 입력 종목 |
| POST | `/api/sync` | 지금 동기화 |
| GET | `/api/portfolio/summary?range=1M` | 총자산, 기간 변화, 비중, 종목별 손익 (`from=&to=` 로 기간 직접 지정, `usdKrw` 포함) |
| GET | `/api/portfolio/history?range=1Y` | 일별 총자산 추이 (날짜별 `usdKrw` 포함) |
| GET | `/api/news?symbol=&market=` | 보유 종목 뉴스 (없으면 상위 5종목 뉴스를 최신순으로) |
