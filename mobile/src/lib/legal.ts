import * as WebBrowser from 'expo-web-browser';
import { ApiError } from './api';
import { loadServerUrl } from './settings';

/** 서버가 공개하는 약관 문서 (server/legal/*.md). 앱 배포 없이 서버에서 내용을 고칠 수 있다 */
export type LegalDoc = 'terms' | 'consent' | 'privacy';

export async function openLegal(doc: LegalDoc) {
  const server = await loadServerUrl();
  if (!server) throw new ApiError('먼저 서버 주소를 설정하세요.');
  await WebBrowser.openBrowserAsync(`${server}/legal/${doc}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
