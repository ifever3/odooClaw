---
name: odoo-channel-webhook-inbound-design
description: Design for replacing the Odoo channel polling flow with webhook-driven inbound events while keeping outbound JSON-RPC reply delivery.
type: project
---

# Odoo channel webhook inbound redesign

## Goal
Replace the current Odoo channel polling flow in this repository with webhook-driven inbound message delivery. Keep outbound replies unchanged for now so the existing JSON-RPC reply path continues to work.

## Scope
In scope:
- Remove polling-based message acquisition from the Odoo channel plugin.
- Accept inbound webhook events from OpenClaw's hook/settings integration.
- Normalize webhook payloads into the existing inbound event shape.
- Reuse the current reply handling pipeline and JSON-RPC outbound delivery.
- Preserve private chat and group mention triggering behavior.

Out of scope:
- Rewriting outbound delivery to webhook.
- Changing the Odoo addon in the other repository.
- Adding new message routing policies beyond the current behavior.
- Building a new HTTP server inside this plugin.

## Current state
The current channel plugin still treats Odoo as a polled channel. The plugin registers a channel implementation, reads Odoo config, and drives message handling through a polling service. Reply delivery already uses JSON-RPC back into Odoo, so the outbound side can stay intact for this phase.

## Target architecture
The channel plugin should become an inbound event consumer instead of a poller.

### Inbound flow
1. OpenClaw receives a webhook from the Odoo addon through its hook/settings system.
2. OpenClaw hands the normalized webhook payload to the Odoo channel plugin.
3. The plugin validates and normalizes the payload into the existing inbound event model.
4. The plugin reuses the current inbound handler to:
   - determine the session and route
   - enqueue the system event
   - build the reply context
   - dispatch the reply
5. Replies continue to use the existing JSON-RPC outbound path.

### Data model
The webhook payload should carry the same information the current poller derives from Odoo messages:
- event type
- message id
- channel id/name/type
- author partner id/name
- bot partner id/name
- message text and optional html
- mention flag
- trigger type
- timestamp

The existing inbound event shape should remain the internal contract so the routing and reply code does not need to be rewritten.

## Components to change

### `index.ts`
- Stop registering the polling service.
- Register the channel as a webhook-driven consumer instead.
- Keep the existing runtime and logger wiring.

### `channel.ts`
- Keep the inbound handling logic.
- Remove or isolate polling-related code.
- Add a webhook entrypoint that accepts the normalized event and passes it into the existing handler.
- Add idempotency protection for repeated webhook deliveries if the OpenClaw hook layer does not already guarantee it.

### `types.ts`
- Keep the webhook event and inbound event interfaces as the shared contract.
- Adjust fields only if the OpenClaw hook layer expects a different normalized payload shape.

### `rpc.ts`
- Keep outbound JSON-RPC delivery unchanged.
- Continue using it to send replies back to Odoo.

## Error handling
- Reject malformed webhook payloads early and log the reason.
- Ignore events that do not contain usable message text.
- Ignore self-authored bot messages to avoid loops.
- Treat outbound RPC failures as reply failures only; they should not break inbound webhook acceptance.
- If webhook delivery is retried, ensure the same message does not trigger duplicate replies.

## Testing strategy
- Verify a webhook payload for a private chat reaches the existing reply pipeline.
- Verify a webhook payload for a group mention reaches the existing reply pipeline.
- Verify non-mention group messages are ignored.
- Verify bot-authored messages are ignored.
- Verify replies still go out through JSON-RPC.
- Verify polling is no longer started by the plugin.

## Migration notes
This phase is intentionally incremental. It keeps the outbound path stable while replacing only the inbound acquisition mechanism. Once this is stable, a later phase can decide whether outbound replies should also move to webhook delivery.

