/* ── Style constants ── */

const STYLES = {
  root: "line-height:1.65;font-size:14px;color:#0f172a;",
  heading: (size: number) => `margin:14px 0 10px 0;padding:0 0 6px 0;font-weight:800;font-size:${size}px;border-bottom:1px solid #e5e7eb;letter-spacing:.1px;`,
  paragraph: "margin:8px 0 14px 0;",
  ul: "margin:8px 0 14px 18px;padding:0;",
  ol: "margin:8px 0 14px 20px;padding:0;",
  li: "margin:6px 0;padding-left:2px;",
  inlineCode: "background:#eef2ff;color:#3730a3;padding:2px 6px;border-radius:6px;font-family:Consolas,monospace;font-size:12px;",
  tableWrapper: "margin:12px 0 16px 0;overflow-x:auto;border:1px solid #e5e7eb;border-radius:12px;",
  table: "border-collapse:collapse;width:100%;font-size:13px;background:#fff;",
  th: "padding:10px 12px;border:1px solid #e5e7eb;background:#f8fafc;text-align:left;font-weight:700;white-space:nowrap;",
  td: "padding:9px 12px;border:1px solid #e5e7eb;vertical-align:top;",
  trEven: "background:#ffffff;",
  trOdd: "background:#fbfdff;",
  notice: (extra: string) => `margin:10px 0 14px 0;padding:10px 12px;border-radius:10px;${extra}`,
} as const;

/* ── Helpers ── */

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineMarkdown(text: string): string {
  let s = escapeHtml(text).replace(/\r?\n/g, "<br/>");
  s = s.replace(/`([^`]+)`/g, `<code style="${STYLES.inlineCode}">$1</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  s = s.replace(/\*(?!\s)([^*]+?)\*/g, "<em>$1</em>");
  return s;
}

function getNoticeStyle(text: string): string | null {
  const lower = text.toLowerCase();
  if (/^(✅|🎉|🟢)/.test(text) || /success|completed|created|confirmed/i.test(lower)) {
    return "background:#ecfdf3;border-left:4px solid #16a34a;";
  }
  if (/^(⚠️|⚠)/.test(text) || /reminder|notice|warning/i.test(lower)) {
    return "background:#fffbeb;border-left:4px solid #d97706;";
  }
  if (/^(❌)/.test(text) || /error|failure|exception/i.test(lower)) {
    return "background:#fef2f2;border-left:4px solid #dc2626;";
  }
  if (/^(ℹ️)/.test(text) || /tip|description|information/i.test(lower)) {
    return "background:#eff6ff;border-left:4px solid #2563eb;";
  }
  return null;
}

function classifyHeadingEmoji(text: string): string | null {
  const trimmed = stripLeadingEmoji(text);
  if (!trimmed) return null;
  if (/^[\p{Extended_Pictographic}\uFE0F\u200D]+/u.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();
  if (/error/i.test(lower)) return "❌";
  if (/warning/i.test(lower)) return "⚠️";
  if (/success|completed|created|confirmed/i.test(lower)) return "✅";
  if (/list|search|show/i.test(lower)) return "🔎";
  if (/purchase|rfq|po/i.test(lower)) return "📦";
  if (/sale order|\bso\b/i.test(lower)) return "🧾";
  if (/invoice|bill/i.test(lower)) return "💰";
  if (/partner|supplier|vendor/i.test(lower)) return "👤";
  if (/summary|conclusion|takeaway|overall|overview/i.test(lower)) return "📌";
  if (/analysis|breakdown|distribution|trend/i.test(lower)) return "📊";
  if (/amount|price|cost|money|value/i.test(lower)) return "💰";
  if (/time|date|timeline/i.test(lower)) return "🕒";
  if (/risk|attention|notice/i.test(lower)) return "⚠️";
  if (/next|recommend|suggest/i.test(lower)) return "💡";

  if(/[\u4e00-\u9fff]/u.test(trimmed)) {
    if (/[\u603b\u7ed3\u6982\u51b5\u6982\u89c8\u6458\u8981\u6c47\u603b\u5206\u6790\u5206\u5e03\u8d8b\u52bf\u62c6\u89e3]/u.test(trimmed)) return "📊";
    if (/[\u4f9b\u5e94\u5546\u5ba2\u6237\u7ecf\u9500\u7ecf\u7406]/u.test(trimmed)) return "👤";
    if (/[\u91d1\u989d\u4ef7\u683c\u6210\u672c\u6536\u5165\u652f\u51fa]/u.test(trimmed)) return "💰";
    if (/[\u65f6\u95f4\u65e5\u671f\u6d41\u7a0b]/u.test(trimmed)) return "🕒";
    if (/[\u98ce\u9669\u8b66\u544a\u6ce8\u610f\u5f85\u5904\u7406]/u.test(trimmed)) return "⚠️";
    if (/[\u5efa\u8bae\u4e0b\u4e00\u6b65\u540e\u7eed\u8ba1\u5212]/u.test(trimmed)) return "💡";
    if (/[\u5982\u4e0b\u6240\u793a\u5168\u90e8\u5168\u4f53\u5171\u8ba1\u5408\u8ba1\u603b\u5171]/u.test(trimmed) || /共\s*\d+/u.test(trimmed)) return "📊";
    return "📌";
  }

  return null;
}

function guessEmojiTitle(text: string): { emoji: string; title: string } | null {
  const first = text.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || "";
  if (!first) return null;

  const emoji = classifyHeadingEmoji(first);
  if (!emoji) return null;
  return { emoji, title: first };
}

function stripLeadingEmoji(text: string): string {
  return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "").trim();
}

function shouldPromoteStandaloneHeading(line: string): boolean {
  if (!line) return false;
  if (line.length > 24) return false;
  if (/[。！？.!?：:]$/.test(line)) return false;
  if (/^[-*]|^\d+[.)]\s+/.test(line)) return false;
  if (/^\|.+\|$/.test(line)) return false;
  if (/^[#>]/.test(line)) return false;
  if (!/[\u4e00-\u9fff]/u.test(line) && !/^[A-Za-z][A-Za-z\s/&-]*$/.test(line)) return false;
  return true;
}

function decorateHeadingText(text: string, level: number): string {
  const trimmed = stripLeadingEmoji(text);
  if (!trimmed) return text;
  if (level >= 3) return trimmed;

  const emoji = classifyHeadingEmoji(trimmed);
  if (emoji) return `${emoji} ${trimmed}`;
  return trimmed;
}

function isMarkdownTable(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length) return false;
  const header = lines[index]?.trim() || "";
  const sep = lines[index + 1]?.trim() || "";
  return /^\|.+\|$/.test(header) && /^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(sep);
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function markdownTableToHtml(lines: string[], index: number): { html: string; nextIndex: number } {
  const headerCells = parseTableRow(lines[index]);
  let i = index + 2;
  const bodyRows: string[][] = [];
  while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
    bodyRows.push(parseTableRow(lines[i]));
    i += 1;
  }

  const thead = `<tr>${headerCells.map((c) => `<th style="${STYLES.th}">${formatInlineMarkdown(c)}</th>`).join("")}</tr>`;
  const tbody = bodyRows.map((row, rowIndex) => `<tr style="${rowIndex % 2 === 0 ? STYLES.trEven : STYLES.trOdd}">${row.map((c) => `<td style="${STYLES.td}">${formatInlineMarkdown(c)}</td>`).join("")}</tr>`).join("");
  return {
    html: `<div style="${STYLES.tableWrapper}"><table style="${STYLES.table}"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`,
    nextIndex: i,
  };
}

function looksLikeDivider(line: string): boolean {
  const normalized = line.replace(/\s+/g, "");
  return /^(?:[-*_])\1{2,}$/.test(normalized) || /^(?:=){3,}$/.test(normalized);
}

function parseKeyValueLine(line: string): { key: string; value: string } | null {
  const match = line.match(/^([^:\n]{1,80}?)[\s]*[:=：][\s]*(.+)$/);
  if (!match) return null;

  const key = match[1].trim();
  const value = match[2].trim();
  if (!key || !value) return null;
  if (/^[-*]\s+/.test(key) || /^\d+[.)]\s+/.test(key) || /^#/.test(key)) return null;
  return { key, value };
}

function renderKvRows(rows: Array<{ key: string; value: string }>): string[] {
  return [
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map((row) => `| ${row.key} | ${row.value} |`),
  ];
}

function tryBuildRecordTable(lines: string[], index: number): { lines: string[]; nextIndex: number } | null {
  const rows: Array<{ key: string; value: string }> = [];
  let i = index;

  while (i < lines.length) {
    const raw = (lines[i] || "").trim();
    if (!raw) break;
    if (looksLikeDivider(raw) || isMarkdownTable(lines, i) || /^#{1,6}\s+/.test(raw) || /^[-*]\s+/.test(raw) || /^\d+[.)]\s+/.test(raw)) {
      break;
    }

    const parsed = parseKeyValueLine(raw);
    if (!parsed) break;
    rows.push(parsed);
    i += 1;
  }

  if (rows.length < 2) return null;
  return { lines: renderKvRows(rows), nextIndex: i };
}

/* ── Preprocessing ── */

function preprocessForOdooRichText(text: string): string {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return normalized;

  const src = normalized.split("\n");
  const out: string[] = [];
  let i = 0;
  let injectedTitle = false;

  const titleGuess = guessEmojiTitle(normalized);
  if (titleGuess) {
    out.push(`## ${titleGuess.emoji} ${titleGuess.title}`);
    injectedTitle = true;
  }

  while (i < src.length) {
    const raw = src[i] ?? "";
    const line = raw.trim();

    if (!line) {
      out.push("");
      i += 1;
      continue;
    }

    if (looksLikeDivider(line)) {
      i += 1;
      continue;
    }

    if (injectedTitle && i === 0 && titleGuess && line === titleGuess.title) {
      i += 1;
      continue;
    }

    if (isMarkdownTable(src, i)) {
      out.push(src[i], src[i + 1]);
      i += 2;
      while (i < src.length && /^\|.+\|$/.test(src[i].trim())) {
        out.push(src[i]);
        i += 1;
      }
      out.push("");
      continue;
    }

    const recordTable = tryBuildRecordTable(src, i);
    if (recordTable) {
      out.push(...recordTable.lines);
      i = recordTable.nextIndex;
      continue;
    }

    const kvRows: Array<{ key: string; value: string }> = [];
    let j = i;
    while (j < src.length) {
      const parsed = parseKeyValueLine(src[j]);
      if (!parsed) break;
      kvRows.push(parsed);
      j += 1;
    }
    if (kvRows.length >= 2) {
      out.push(...renderKvRows(kvRows), "");
      i = j;
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      const nextLine = (src[i + 1] || "").trim();
      if (nextLine && /^[-*]\s+/.test(nextLine)) {
        out.push(`### ${numbered[2]}`);
      } else {
        out.push(`${numbered[1]}. ${numbered[2]}`);
      }
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const body = line.replace(/^[-*]\s+/, "").trim();
      out.push(`- ${body}`);
      i += 1;
      continue;
    }

    if (/^(Next|You can also|Next step|Can continue|Can execute|Follow-up|Recommended next step)/i.test(line)) {
      out.push(`### ${line}`);
      i += 1;
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── Main export ── */

export function formatOdooRichText(text: string): string {
  const normalized = preprocessForOdooRichText(text);
  if (!normalized) return "<div> </div>";

  const lines = normalized.split("\n");
  const parts: string[] = [`<div class="openclaw-rich" style="${STYLES.root}">`];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (isMarkdownTable(lines, i)) {
      const table = markdownTableToHtml(lines, i);
      parts.push(table.html);
      i = table.nextIndex;
      continue;
    }

    const h4 = line.match(/^####\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h1 = line.match(/^#\s+(.+)$/);
    if (h4 || h3 || h2 || h1) {
      const textValue = h4?.[1] || h3?.[1] || h2?.[1] || h1?.[1] || line;
      const level = h1 ? 1 : h2 ? 2 : h3 ? 3 : 4;
      const decoratedText = decorateHeadingText(textValue, level);
      const size = h1 ? 20 : h2 ? 18 : h3 ? 16 : 15;
      parts.push(`<div style="${STYLES.heading(size)}">${formatInlineMarkdown(decoratedText)}</div>`);
      i += 1;
      continue;
    }

    if (shouldPromoteStandaloneHeading(line)) {
      const decoratedText = decorateHeadingText(line, 2);
      parts.push(`<div style="${STYLES.heading(18)}">${formatInlineMarkdown(decoratedText)}</div>`);
      i += 1;
      continue;
    }

    if (/^([-*])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      parts.push(`<ul style="${STYLES.ul}">${items.map((item) => `<li style="${STYLES.li}">${formatInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      parts.push(`<ol style="${STYLES.ol}">${items.map((item) => `<li style="${STYLES.li}">${formatInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const block: string[] = [line];

    i += 1;
    while (i < lines.length) {
      const next = (lines[i] || "").trim();
      if (!next || isMarkdownTable(lines, i) || /^#{1,3}\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+[.)]\s+/.test(next)) break;
      block.push(next);
      i += 1;
    }

    const joined = block.join("\n");
    const noticeStyle = block.length === 1 ? getNoticeStyle(block[0]) : null;
    if (noticeStyle) {
      parts.push(`<div style="${STYLES.notice(noticeStyle)}">${formatInlineMarkdown(joined)}</div>`);
    } else {
      parts.push(`<p style="${STYLES.paragraph}">${formatInlineMarkdown(joined)}</p>`);
    }
  }

  parts.push("</div>");
  return parts.join("");
}

/**
 * Strip HTML tags and decode entities from Odoo message body.
 * Also removes `@BotName` mention patterns.
 */
export function cleanOdooBody(html: string): string {
  // 1. Remove all HTML tags
  let text = (html || "").replace(/<[^>]+>/g, " ");

  // 2. Decode standard entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

  // 3. Remove @mentions (consistent with Odoo plugin's _strip_mention)
  // Odoo wraps mentions in <a class="o_mail_redirect">@Name</a> — after HTML
  // tag stripping (step 1), mentions become bare "@Name " tokens.
  // Only strip the single @-word; do NOT consume subsequent words, otherwise
  // pure-English messages like "@Bot hello world" get entirely eaten.
  text = text.replace(/@[\w\-_.]+\s*/g, "");

  // 4. Final cleanup
  return text.replace(/\s+/g, " ").trim();
}
