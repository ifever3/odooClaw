import type { ChannelProvider, ResolvedChannel } from "./types.ts";
import type { OdooConfig } from "../rpc.ts";
import { odooRpc } from "../rpc.ts";

/**
 * Odoo Discuss provider.
 */
export const discussProvider: ChannelProvider = {
  id: "discuss",
  label: "Odoo Discuss",

  async sendMessage(cfg: OdooConfig, channelId: number, text: string, isHtml = false): Promise<void> {
    await odooRpc(cfg, "discuss.channel", "openclaw_post_bot_message", [[channelId], text], {
      author_partner_id: cfg.botPartnerId,
      is_html: isHtml,
    });
  },

  async resolveChannel(cfg: OdooConfig, channelId: number): Promise<ResolvedChannel | null> {
    const channels = await odooRpc(cfg, "discuss.channel", "search_read", [[
      ["id", "=", channelId],
    ]], {
      fields: ["id", "name", "channel_type"],
      limit: 1,
    });
    const ch = channels?.[0];
    if (!ch) return null;
    return {
      id: ch.id,
      name: ch.name,
      type: ch.channel_type === "chat" ? "dm" : "group",
      isPrivate: ch.channel_type === "chat",
    };
  },

  shouldRespond(channel: ResolvedChannel): boolean {
    return channel.isPrivate;
  },
};
