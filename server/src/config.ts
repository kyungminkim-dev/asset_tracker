function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env.example 을 참고하세요.`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  appToken: required('APP_TOKEN'),
  encryptionKey: required('ENCRYPTION_KEY'),
  dbPath: process.env.DB_PATH ?? './data/asset-tracker.db',
  snapshotCron: process.env.SNAPSHOT_CRON ?? '10 16 * * *',
  timezone: 'Asia/Seoul',
};
