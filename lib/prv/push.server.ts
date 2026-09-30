/**
 * Server-side Web Push for PRV reminders.
 *
 * VAPID keys come from the environment, so no private key is ever committed or sent to the
 * browser. Subscriptions are stored server-side and only ever handed back to a caller that already
 * holds a PRV session.
 *
 * When the keys are not configured, `isPushConfigured()` is false and the UI offers in-app
 * notifications instead of pretending to have push.
 */
import "server-only";

import webpush from "web-push";

import { readCollection, updateCollection } from "./store.server";

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  userAgent: string;
  failures: number;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.PUSH_PRIVATE_KEY?.trim();
  // VAPID requires a real contact. There is deliberately no default: guessing one would either
  // break delivery or hide the fact that push was never set up.
  const subject = process.env.PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export function getPublicKey(): string | null {
  return process.env.PUSH_PUBLIC_KEY?.trim() || null;
}

function subscriptions(): PushSubscriptionRecord[] {
  return readCollection<PushSubscriptionRecord>("push-subscriptions");
}

export async function addSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}): Promise<PushSubscriptionRecord> {
  const record: PushSubscriptionRecord = {
    endpoint: input.endpoint,
    keys: { p256dh: input.p256dh, auth: input.auth },
    createdAt: new Date().toISOString(),
    userAgent: input.userAgent.slice(0, 200),
    failures: 0,
  };
  await updateCollection<PushSubscriptionRecord>("push-subscriptions", (items) => {
    const without = items.filter((item) => item.endpoint !== record.endpoint);
    return [...without, record];
  });
  return record;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await updateCollection<PushSubscriptionRecord>("push-subscriptions", (items) =>
    items.filter((item) => item.endpoint !== endpoint)
  );
}

/**
 * Sends one push message to every stored subscription.
 *
 * Subscriptions the browser has expired (404/410) are dropped, so the list does not grow forever.
 * Returns counts rather than provider responses, so nothing about a device leaks to the caller.
 */
export async function sendPush(payload: { title: string; body: string; url?: string }): Promise<{
  sent: number;
  removed: number;
  configured: boolean;
}> {
  if (!ensureConfigured()) return { sent: 0, removed: 0, configured: false };

  const current = subscriptions();
  const body = JSON.stringify({
    title: payload.title.slice(0, 120),
    body: payload.body.slice(0, 300),
    url: typeof payload.url === "string" ? payload.url.slice(0, 200) : "/prv",
  });

  let sent = 0;
  const expired: string[] = [];
  for (const record of current) {
    try {
      await webpush.sendNotification(
        { endpoint: record.endpoint, keys: record.keys },
        body,
        { TTL: 60 * 60 * 24 }
      );
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) expired.push(record.endpoint);
    }
  }

  if (expired.length > 0) {
    await updateCollection<PushSubscriptionRecord>("push-subscriptions", (items) =>
      items.filter((item) => !expired.includes(item.endpoint))
    );
  }
  return { sent, removed: expired.length, configured: true };
}
