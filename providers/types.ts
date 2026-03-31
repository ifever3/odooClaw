import type { OdooConfig } from "../rpc.ts";

/* ── Normalized inbound message ── */

export interface InboundMessage {
  id: number;
  body: string;
  authorId: [number, string] | null;
  partnerIds: number[];
  channelId: number;
  date?: string;
}

/* ── Webhook ingress payload ── */

export interface OdooWebhookEvent {
  eventType: string;
  messageId: number;
  timestamp?: string | number;
  triggerType?: "dm" | "mention" | (string & {});
  channel: {
    id: number;
    name?: string;
    type?: string;
    isPrivate?: boolean;
  };
  author: {
    partnerId?: number | null;
    name?: string;
  };
  bot?: {
    partnerId?: number | null;
    name?: string;
  };
  message: {
    text?: string;
    html?: string;
  };
  mention?: {
    mentioned?: boolean;
  };
}

/* ── Resolved channel metadata ── */

export interface ResolvedChannel {
  id: number;
  name?: string;
  /** Semantic type used for routing: "dm", "group", "ticket", "livechat", etc. */
  type: "dm" | "group" | "ticket" | "livechat" | (string & {});
  isPrivate: boolean;
}

/* ── Channel provider contract ── */

/**
 * A `ChannelProvider` encapsulates all backend-specific logic for one
 * Odoo channel source (Discuss, Helpdesk, Live Chat, …).
 *
 * The webhook entrypoint in `channel.ts` delegates to these methods
 * so that adding a new backend requires only a new provider file.
 */
export interface ChannelProvider {
  /** Unique provider identifier, e.g. "discuss", "helpdesk". */
  id: string;
  /** Human-readable label shown in logs and UI. */
  label: string;
  /** Send a text (or HTML) reply to the given channel / record. */
  sendMessage(cfg: OdooConfig, channelId: number, text: string, isHtml?: boolean): Promise<void>;
  /** Look up channel / record metadata needed for routing. */
  resolveChannel(cfg: OdooConfig, channelId: number): Promise<ResolvedChannel | null>;
  /**
   * Decide whether the bot should respond to this message.
   * Typical checks: is it a DM? was the bot @mentioned?
   */
  shouldRespond(channel: ResolvedChannel, msg: InboundMessage, cfg: OdooConfig): boolean;
  /**
   * Optional outbound formatter.
   * When absent the default `formatOdooRichText` is used.
   */
  formatOutbound?(text: string): string;
}
