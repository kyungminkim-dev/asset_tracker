import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { escapeHtml } from './html.js';

/**
 * 이용약관 · 개인정보 수집·이용 동의 · 개인정보 처리방침.
 * 원문은 server/legal/*.md 이고, {{운영자}} 같은 자리는 .env 의 LEGAL_* 값으로 채운다.
 * 누구나 볼 수 있어야 하므로(앱스토어·OAuth 설정의 개인정보 처리방침 URL) 로그인 없이 공개한다.
 */

export const LEGAL_DOCS = {
  terms: '서비스 이용약관',
  consent: '개인정보 수집·이용 동의',
  privacy: '개인정보 처리방침',
} as const;
type Doc = keyof typeof LEGAL_DOCS;

const sources = Object.fromEntries(
  (Object.keys(LEGAL_DOCS) as Doc[]).map((doc) => [doc, readFileSync(new URL(`../legal/${doc}.md`, import.meta.url), 'utf8')]),
) as Record<Doc, string>;

// 채워지지 않은 자리는 이 표시로 남겨 화면에서 눈에 띄게 한다
const MISSING = (label: string) => `⟦${label} 입력 필요⟧`;

function values(): Record<string, string> {
  const l = config.legal;
  const overseas = !l.serverLocation
    ? MISSING('서버 위치 (LEGAL_SERVER_LOCATION)')
    : l.serverLocation === '대한민국'
      ? '운영자는 이용자의 개인정보를 국외로 이전하지 않습니다.'
      : `운영자는 서비스 제공을 위해 이용자의 개인정보를 국외에 보관합니다.\n\n` +
        `- 이전받는 자: ${l.hosting || MISSING('호스팅 업체 (LEGAL_HOSTING)')}\n` +
        `- 이전되는 국가: ${l.serverLocation}\n` +
        `- 이전 일시와 방법: 서비스 이용 시 네트워크를 통해 전송\n` +
        `- 이전 항목: 2항의 개인정보 전체\n` +
        `- 이용 목적과 보유 기간: 서버 운영 및 데이터 보관, 회원 탈퇴 시까지\n\n` +
        `이용자는 국외 이전을 거부할 수 있으나, 이 경우 서비스를 이용할 수 없습니다.`;
  return {
    서비스명: l.serviceName,
    운영자: l.operator || MISSING('운영자 (LEGAL_OPERATOR)'),
    연락처: l.contactEmail || MISSING('연락처 이메일 (LEGAL_CONTACT_EMAIL)'),
    보호책임자: l.privacyOfficer || MISSING('개인정보 보호책임자 (LEGAL_PRIVACY_OFFICER)'),
    호스팅: l.hosting || MISSING('호스팅 업체 (LEGAL_HOSTING)'),
    서버위치: l.serverLocation || MISSING('서버 위치 (LEGAL_SERVER_LOCATION)'),
    시행일: l.effectiveDate || MISSING('시행일 (LEGAL_EFFECTIVE_DATE)'),
    국외이전: overseas,
  };
}

/** 이 문서들에 쓰는 정도의 마크다운만 HTML 로 바꾼다: 제목(#~###), 목록(-, 1.), 문단, **굵게** */
function renderMarkdown(md: string): string {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/⟦(.+?)⟧/g, '<mark>$1</mark>');

  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let nested = false; // 들여쓴 목록 (항목 안의 하위 목록)
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (nested) out.push('</ul></li>');
    if (list) out.push(`</${list}>`);
    list = null;
    nested = false;
  };

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const sub = /^\s{2,}- (.*)$/.exec(line);
    const ul = /^- (.*)$/.exec(line);
    const ol = /^\d+\. (.*)$/.exec(line);
    const heading = /^(#{1,3}) (.*)$/.exec(line);

    if (sub && list) {
      flushPara();
      // 직전 <li> 를 열어 두고 하위 목록을 붙인다
      if (!nested) {
        out[out.length - 1] = out[out.length - 1]!.replace(/<\/li>$/, '');
        out.push('<ul>');
        nested = true;
      }
      out.push(`<li>${inline(sub[1]!)}</li>`);
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (nested) {
        out.push('</ul></li>');
        nested = false;
      }
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul ?? ol)![1]!)}</li>`);
    } else if (heading) {
      flushPara();
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
    } else if (line.trim() === '') {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return out.join('\n');
}

export function renderLegal(doc: Doc): { html: string; complete: boolean } {
  const vals = values();
  // 국외이전처럼 여러 줄짜리 값도 마크다운으로 해석되도록 먼저 채운 뒤 변환한다
  const md = sources[doc].replace(/\{\{(.+?)\}\}/g, (_, key: string) => vals[key] ?? `⟦${key}⟧`);
  return { html: renderMarkdown(md), complete: !md.includes('⟦') };
}

export function registerLegalRoutes(app: FastifyInstance) {
  app.get<{ Params: { doc: string } }>('/legal/:doc', async (req, reply) => {
    const doc = req.params.doc as Doc;
    if (!(doc in LEGAL_DOCS)) return reply.code(404).send({ error: 'not found' });
    const { html, complete } = renderLegal(doc);
    const nav = (Object.keys(LEGAL_DOCS) as Doc[])
      .map((d) => `<a href="/legal/${d}"${d === doc ? ' aria-current="page"' : ''}>${LEGAL_DOCS[d]}</a>`)
      .join('');
    return reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'no-cache')
      .send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(LEGAL_DOCS[doc])} - ${escapeHtml(config.legal.serviceName)}</title>
<style>
  :root { --bg:#fff; --text:#191F28; --sub:#4E5968; --muted:#8B95A1; --line:#E5E8EB; --chip:#F2F4F6; --primary:#3182F6; --mark:#FFF3BF; }
  @media (prefers-color-scheme: dark) { :root { --bg:#101013; --text:#F3F4F6; --sub:#C3C3C8; --muted:#8A8A93; --line:#2C2C34; --chip:#2C2C34; --primary:#4593FC; --mark:#5C4A00; } }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
         line-height:1.7; word-break:keep-all; overflow-wrap:anywhere; }
  main { max-width:720px; margin:0 auto; padding:20px 20px 64px; }
  nav { display:flex; gap:6px; overflow-x:auto; margin-bottom:24px; }
  nav a { flex:none; padding:7px 12px; border-radius:10px; color:var(--muted); text-decoration:none; font-size:14px; white-space:nowrap; }
  nav a[aria-current] { background:var(--chip); color:var(--text); font-weight:700; }
  h1 { font-size:24px; line-height:1.35; letter-spacing:-0.5px; margin:0 0 20px; }
  h2 { font-size:17px; margin:32px 0 8px; } h3 { font-size:15px; margin:20px 0 6px; }
  p, li { color:var(--sub); font-size:15px; } ul, ol { padding-left:20px; } li { margin:4px 0; }
  strong { color:var(--text); }
  mark { background:var(--mark); color:var(--text); padding:0 4px; border-radius:4px; }
  .draft { background:var(--mark); color:var(--text); border-radius:12px; padding:12px 14px; font-size:14px; margin-bottom:20px; }
</style></head><body><main>
<nav>${nav}</nav>
${complete ? '' : '<div class="draft">초안입니다. 노란색으로 표시된 항목을 채우고, 공개 전에 법률 검토를 받으세요.</div>'}
${html}
</main></body></html>`);
  });
}
