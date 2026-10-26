function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env.example 을 참고하세요.`);
  return value;
}

const list = (value: string | undefined, fallback: string[]) =>
  value ? value.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** 외부에서 접근 가능한 서버 주소. OAuth 콜백 주소를 만들 때 쓴다 */
  publicUrl: required('PUBLIC_URL').replace(/\/+$/, ''),
  encryptionKey: required('ENCRYPTION_KEY'),
  dbPath: process.env.DB_PATH ?? './data/asset-tracker.db',
  snapshotCron: process.env.SNAPSHOT_CRON ?? '10 16 * * *',
  timezone: 'Asia/Seoul',
  sessionDays: Number(process.env.SESSION_DAYS ?? 90),
  /** 로그인 후 돌아갈 수 있는 앱 주소 (exp:// 는 Expo Go 개발용) */
  appRedirectPrefixes: list(process.env.APP_REDIRECT_PREFIXES, ['assettracker://', 'exp://']),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  kakao: {
    restApiKey: process.env.KAKAO_REST_API_KEY ?? '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
  },
  /** 개발용 테스트 로그인. 누구나 같은 테스트 계정으로 들어올 수 있으므로 배포 서버에서는 절대 켜지 말 것 */
  devLogin: process.env.DEV_LOGIN === 'true',
  /** 약관·개인정보 처리방침에 들어가는 운영자 정보. 비어 있으면 문서에 "입력 필요"로 표시된다 */
  legal: {
    serviceName: process.env.LEGAL_SERVICE_NAME || '자산 트래커',
    operator: process.env.LEGAL_OPERATOR ?? '',
    contactEmail: process.env.LEGAL_CONTACT_EMAIL ?? '',
    privacyOfficer: process.env.LEGAL_PRIVACY_OFFICER ?? '',
    hosting: process.env.LEGAL_HOSTING ?? '',
    serverLocation: process.env.LEGAL_SERVER_LOCATION ?? '',
    effectiveDate: process.env.LEGAL_EFFECTIVE_DATE ?? '',
  },
};
