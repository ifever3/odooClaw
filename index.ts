import type { IncomingMessage, ServerResponse } from "node:http";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { getCfg } from "./config.ts";
import { handleWebhookEvent, registerWebhookService, odooPlugin } from "./channel.ts";
import { getProvider } from "./providers/registry.ts";
import { registerOdooApiTool } from "./tools/odoo-api.ts";
import { setOdooRuntime } from "./runtime.ts";
import { setRpcLogger } from "./rpc.ts";

const plugin = {
  id: "odoo-tools",
  name: "Odoo ERP Tools + Channel",
  description: "Odoo ERP API tool with AI skill and configurable channel integration (Discuss, Helpdesk, etc.)",
  configSchema: emptyPluginConfigSchema(),

  register(api: any) {
    setOdooRuntime(api.runtime);

    if (api.logger) {
      setRpcLogger({ info: (m) => api.logger!.info(m), error: (m) => api.logger!.error(m) });
    }

    registerOdooApiTool(api);
    api.registerChannel({ plugin: odooPlugin as any });
    registerWebhookService(api);

    api.registerHttpRoute({
      path: "/odoo/webhook",
      match: "exact",
      auth: "plugin",
      replaceExisting: true,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if ((req.method || "").toUpperCase() !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end("Method Not Allowed");
          return true;
        }

        const cfg = getCfg(api);
        if (!cfg) {
          res.statusCode = 503;
          res.end("Odoo not configured");
          return true;
        }

        const token = api.config?.hooks?.token || process.env.OPENCLAW_HOOKS_TOKEN || process.env.ODOO_WEBHOOK_SECRET || cfg.webhookSecret;
        const auth = req.headers.authorization || req.headers["x-openclaw-token"];
        const bearer = typeof auth === "string" ? auth : Array.isArray(auth) ? auth[0] : "";
        const expected = token ? `Bearer ${token}` : "";
        if (!token || (bearer !== expected && bearer !== token)) {
          res.statusCode = 401;
          res.end("Unauthorized");
          return true;
        }

        const rawBody = await new Promise<string>((resolve, reject) => {
          let data = "";
          req.on("data", (chunk) => {
            data += chunk;
          });
          req.on("end", () => resolve(data));
          req.on("error", reject);
        });

        let payload: any;
        try {
          payload = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          res.statusCode = 400;
          res.end("Invalid Odoo webhook JSON");
          return true;
        }

        const channelId = Number(payload.channelId ?? payload.channel?.id ?? 0);
        const channelName = String(payload.channelName ?? payload.channel?.name ?? `channel-${channelId || "unknown"}`);
        const channelType = String(payload.channelType ?? payload.channel?.type ?? (payload.isPrivateChat ? "direct" : "group"));
        const isPrivate = Boolean(payload.isPrivateChat ?? payload.channel?.isPrivate ?? (channelType === "chat" || channelType === "direct"));
        const html = String(payload.body ?? payload.message?.html ?? "");
        const text = String(payload.cleanBody ?? payload.message?.text ?? payload.body ?? "");
        const messageId = Number(payload.messageId ?? payload.id ?? Date.now());
        const authorPartnerId = payload.authorPartnerId ?? payload.author?.partnerId ?? null;
        const authorName = String(payload.authorName ?? payload.author?.name ?? "Unknown User");
        const mentioned = Boolean(payload.mentionsBot ?? payload.mention?.mentioned ?? payload.mentionedBot ?? false);

        const event = {
          messageId,
          timestamp: payload.timestamp ?? new Date().toISOString(),
          author: { partnerId: authorPartnerId, name: authorName },
          channel: { id: channelId, name: channelName, type: channelType, isPrivate },
          message: { html, text },
          mention: { mentioned },
        };

        try {
          await handleWebhookEvent(api, event as any);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          api.logger?.error(`[odoo-tools] webhook handling failed: ${String(error)}`);
          res.statusCode = 500;
          res.end("Webhook handling failed");
        }
        return true;
      },
    });

    const cfg = getCfg(api);
    if (cfg) {
      const providerLabel = getProvider(cfg.provider).label;
      api.logger?.info(`[odoo-tools] plugin loaded — provider: ${providerLabel}, url: ${cfg.url}, db: ${cfg.db}, uid: ${cfg.uid}`);
    } else {
      api.logger?.info(
        "[odoo-tools] plugin loaded but Odoo config is INCOMPLETE. " +
          "Webhook ingress will not accept events until channels.odoo (or ODOO_* env vars) are properly configured.",
      );
    }
  },
};

export default plugin;
