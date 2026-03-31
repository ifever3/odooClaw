import type { ClawdbotPluginApi } from "openclaw/plugin-sdk";

import type { OdooConfig } from "./rpc.ts";
import type { ChannelProvider, InboundMessage, OdooWebhookEvent, ResolvedChannel } from "./providers/types.ts";
import { getCfg } from "./config.ts";
import { getOdooRuntime } from "./runtime.ts";
import { formatOdooRichText, cleanOdooBody } from "./rich-text.ts";
import { getProvider } from "./providers/registry.ts";

/* ── Tracking sent message IDs for reliable bot-echo filtering ── */

const sentMessageIds = new Set<number>();
const SENT_IDS_MAX = 500;

/* ── Channel resolution cache (LRU-like) ── */

const channelCache = new Map<number, { data: ResolvedChannel | null; ts: number }>();
const CHANNEL_CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const CHANNEL_CACHE_MAX = 200;

function getCachedChannel(id: number): ResolvedChannel | null | undefined {
  const entry = channelCache.get(id);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CHANNEL_CACHE_TTL_MS) {
    channelCache.delete(id);
    return undefined;
  }
  return entry.data;
}

function setCachedChannel(id: number, data: ResolvedChannel | null) {
  if (channelCache.size >= CHANNEL_CACHE_MAX) {
    const firstKey = channelCache.keys().next().value;
    if (firstKey !== undefined) channelCache.delete(firstKey);
  }
  channelCache.set(id, { data, ts: Date.now() });
}

export function trackSentMessageId(id: number) {
  sentMessageIds.add(id);
  if (sentMessageIds.size > SENT_IDS_MAX) {
    const first = sentMessageIds.values().next().value;
    if (first !== undefined) sentMessageIds.delete(first);
  }
}

/* ── Filter: framework / system diagnostic messages ── */

const SYSTEM_DIAGNOSTIC_PATTERNS = [
  /Gateway restart update skipped/i,
  /openclaw\s+doctor/i,
  /Run:\s*openclaw\s/i,
];

/** Returns true when the text looks like an internal framework diagnostic that should not be forwarded to Odoo. */
function isSystemDiagnostic(text: string): boolean {
  return SYSTEM_DIAGNOSTIC_PATTERNS.some((p) => p.test(text));
}

/* ── Saved plugin API reference for outbound ── */

let savedApi: ClawdbotPluginApi | null = null;

/* ── Channel plugin definition ── */

export const odooPlugin = {
  id: "odoo",
  meta: {
    id: "odoo",
    label: "Odoo Channel",
    selectionLabel: "Odoo Channel (local deploy)",
    docsPath: "/channels/odoo",
    blurb: "Odoo channel plugin supporting DMs and group channels via configurable providers (Discuss, Helpdesk, etc.).",
    aliases: ["odoo", "odoo-discuss"],
  },
  capabilities: {
    chatTypes: ["direct", "group"],
  },
  config: {
    listAccountIds: (cfg: any) => {
      const channelCfg = cfg?.channels?.odoo;
      return channelCfg ? ["default"] : [];
    },
    resolveAccount: (cfg: any, accountId: string) => {
      const channelCfg = cfg?.channels?.odoo;
      return channelCfg ? { accountId, ...(channelCfg.odoo || channelCfg) } : null;
    },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text, to }: { text: string; to: string }) => {
      if (!savedApi) return { ok: false, error: "Odoo plugin API not initialized" };
      const cfg = getCfg(savedApi);
      if (!cfg) return { ok: false, error: "Odoo not configured" };

      if (isSystemDiagnostic(text)) return { ok: true };

      const match = to.match(/^(?:channel|chat|group):(\d+)$/) ?? to.match(/^(\d+)$/);
      if (!match) return { ok: false, error: `Invalid 'to' format: ${to}` };

      const channelId = parseInt(match[1], 10);
      const provider = getProvider(cfg.provider);
      await provider.sendMessage(cfg, channelId, text);
      return { ok: true };
    },
  },
};

/* ── Inbound: route to agent session ── */

async function handleInboundMessage(
  api: ClawdbotPluginApi,
  cfg: OdooConfig,
  msg: InboundMessage,
  channel: ResolvedChannel,
  provider: ChannelProvider,
) {
  const core = getOdooRuntime();
  const channelId = msg.channelId;

  const isPrivateChat = channel.isPrivate;
  const authorId = String(msg.authorId?.[0] ?? "unknown");
  const authorName = msg.authorId?.[1] ?? "Unknown User";
  const peerId = String(channelId);
  const resolvedRoute = core.channel.routing.resolveAgentRoute({
    cfg: api.config,
    channel: "odoo",
    accountId: "default",
    peer: {
      kind: isPrivateChat ? "dm" : "group",
      id: peerId,
    },
    messageText: isPrivateChat ? cleanOdooBody(msg.body) : null,
  });
  const agentId = resolvedRoute?.agentId || "main";
  const accountId = resolvedRoute?.accountId || "default";
  const sessionKey = `agent:${agentId}:odoo:${isPrivateChat ? "dm" : "group"}:${peerId}`;
  const chatType = isPrivateChat ? "direct" : "group";
  const to = isPrivateChat ? `chat:${channelId}` : `channel:${channelId}`;
  const fromLabel = isPrivateChat ? authorName : `${channel.name || `channel-${channelId}`} / ${authorName}`;
  const bodyText = cleanOdooBody(msg.body);

  core.system.enqueueSystemEvent(
    isPrivateChat
      ? `Odoo DM from ${authorName}: ${bodyText.slice(0, 160)}`
      : `Odoo message in ${channel.name || channelId} from ${authorName}: ${bodyText.slice(0, 160)}`,
    {
      sessionKey,
      contextKey: `odoo:message:${channelId}:${msg.id}`,
    },
  );

  const body = core.channel.reply.formatInboundEnvelope({
    channel: provider.label,
    from: fromLabel,
    timestamp: msg.date ? Date.parse(msg.date) : undefined,
    body: bodyText,
    chatType,
    sender: { name: authorName, id: authorId },
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: bodyText,
    CommandBody: bodyText,
    From: isPrivateChat ? `odoo:${authorId}` : `odoo:channel:${channelId}`,
    To: to,
    SessionKey: sessionKey,
    AccountId: accountId,
    ChatType: chatType,
    ConversationLabel: fromLabel,
    GroupSubject: !isPrivateChat ? (channel.name || `channel-${channelId}`) : undefined,
    SenderName: authorName,
    SenderId: authorId,
    Provider: "odoo",
    Surface: "odoo",
    MessageSid: String(msg.id),
    Timestamp: msg.date ? Date.parse(msg.date) : undefined,
    WasMentioned: !isPrivateChat ? msg.partnerIds.includes(cfg.botPartnerId) : undefined,
    OriginatingChannel: "odoo",
    OriginatingTo: to,
  });

  if (isPrivateChat) {
    const storePath = core.channel.session.resolveStorePath(api.config?.session?.store, {
      agentId: agentId,
    });
    await core.channel.session.updateLastRoute({
      storePath,
      sessionKey,
      deliveryContext: {
        channel: "odoo",
        to,
        accountId: accountId,
      },
    });
  }

  const textLimit = core.channel.text.resolveTextChunkLimit(api.config, "odoo", "default", {
    fallbackLimit: 4000,
  });
  const chunkMode = core.channel.text.resolveChunkMode(api.config, "odoo", "default");
  const formatFn = provider.formatOutbound ?? formatOdooRichText;
  const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
    humanDelay: core.channel.reply.resolveHumanDelayConfig(api.config, agentId),
    deliver: async (payload: { text?: string }) => {
      const text = payload.text ?? "";
      if (isSystemDiagnostic(text)) return;
      const chunks = core.channel.text.chunkMarkdownTextWithMode(text, textLimit, chunkMode);
      for (const chunk of chunks.length > 0 ? chunks : [text]) {
        if (!chunk) continue;
        await provider.sendMessage(cfg, channelId, formatFn(chunk), true);
      }
    },
    onError: (err: unknown, info: { kind: string }) => {
      api.logger?.error(`odoo ${info.kind} reply failed: ${String(err)}`);
    },
  });

  await core.channel.reply.dispatchReplyFromConfig({
    ctx: ctxPayload,
    cfg: api.config,
    dispatcher,
    replyOptions,
  });
  markDispatchIdle();
}

function normalizeWebhookEvent(event: OdooWebhookEvent, botPartnerId: number): InboundMessage {
  const body = event.message.html?.trim() || event.message.text?.trim() || "";
  return {
    id: event.messageId,
    body,
    authorId: event.author.partnerId != null ? [event.author.partnerId, event.author.name ?? "Unknown User"] : null,
    partnerIds: event.mention?.mentioned ? [botPartnerId] : [],
    channelId: event.channel.id,
    date: typeof event.timestamp === "number" ? new Date(event.timestamp).toISOString() : event.timestamp,
  };
}

function resolveWebhookChannel(event: OdooWebhookEvent): ResolvedChannel {
  return {
    id: event.channel.id,
    name: event.channel.name,
    type: event.triggerType === "dm" || event.channel.isPrivate ? "dm" : event.channel.type || "group",
    isPrivate: event.triggerType === "dm" || event.channel.isPrivate === true,
  };
}

export async function handleWebhookEvent(api: ClawdbotPluginApi, event: OdooWebhookEvent) {
  const cfg = getCfg(api);
  if (!cfg) {
    throw new Error("Odoo not configured");
  }

  if (sentMessageIds.has(event.messageId)) return;

  const bodyText = cleanOdooBody(event.message.html?.trim() || event.message.text?.trim() || "");
  if (!bodyText) return;

  if (event.author.partnerId === cfg.botPartnerId) return;

  const channel = resolveWebhookChannel(event);
  const msg = normalizeWebhookEvent(event, cfg.botPartnerId);
  const provider = getProvider(cfg.provider);

  if (!getCachedChannel(channel.id)) {
    setCachedChannel(channel.id, channel);
  }

  if (!provider.shouldRespond(channel, msg, cfg)) return;

  api.logger?.info(
    `odoo-channel webhook: new message ch=${channel.id} provider=${provider.id} from=${event.author.name ?? "unknown"}: ${bodyText.slice(0, 80)}`,
  );

  await handleInboundMessage(api, cfg, msg, channel, provider);
}

export function registerWebhookService(api: ClawdbotPluginApi) {
  savedApi = api;

  api.registerService({
    id: "odoo-webhook",
    start: async () => {
      api.logger?.info("odoo-channel: webhook service registered");
    },
    stop: async () => {
      channelCache.clear();
      api.logger?.info("odoo-channel: webhook service stopped");
    },
  });
}
