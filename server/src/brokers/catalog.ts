import { manualBroker } from './manual.js';

/**
 * 아직 API 연동이 없는 국내 증권사 목록. 앱의 "자산 연결" 화면에 그대로 보인다.
 * 증권사 API 를 연동하면 여기서 빼고 같은 id 로 api 정의를 만들어 registry.ts 에 등록한다.
 */
export const manualInstitutions = [
  manualBroker('kiwoom', '키움증권', 'REST API 연동 준비 중이에요. 지금은 보유 종목을 직접 입력해요.'),
  manualBroker('miraeasset', '미래에셋증권'),
  manualBroker('samsung', '삼성증권'),
  manualBroker('nh', 'NH투자증권'),
  manualBroker('kb', 'KB증권'),
  manualBroker('shinhan', '신한투자증권'),
  manualBroker('hana', '하나증권'),
  manualBroker('kakaopay', '카카오페이증권'),
  manualBroker('daishin', '대신증권'),
  manualBroker('meritz', '메리츠증권'),
  manualBroker('hanwha', '한화투자증권'),
  manualBroker('ls', 'LS증권'),
  manualBroker('yuanta', '유안타증권'),
  manualBroker('kyobo', '교보증권'),
  manualBroker('db', 'DB증권'),
  manualBroker('im', 'iM증권'),
  manualBroker('hyundaicar', '현대차증권'),
  manualBroker('ibk', 'IBK투자증권'),
  manualBroker('eugene', '유진투자증권'),
  manualBroker('sk', 'SK증권'),
];
