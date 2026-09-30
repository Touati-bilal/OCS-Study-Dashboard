"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PrvNotice, PrvPanel, PrvStat } from "@/components/prv/PrvPanel";
import { formatShortDate, todayIso } from "@/lib/prv/weekly";
import { useAppStore } from "@/store/useAppStore";

/**
 * PRV · Notifications.
 *
 * Two independent channels, both optional:
 *   - Web Push, which needs VAPID keys in the server environment and a granted permission.
 *   - In-app reminders, which use nothing but the `Notification` API and are computed from the real
 *     task store, so they work with no server configuration at all.
 *
 * When neither is available the page says so plainly rather than showing a dead button.
 */
/** Decodes a VAPID key into a fresh ArrayBuffer, which is what `applicationServerKey` expects. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export default function PrvNotificationsPage() {
  const tasks = useAppStore((state) => state.tasks);
  const [config, setConfig] = useState<{ configured: boolean; publicKey: string | null; devices: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window);
    let cancelled = false;
    fetch("/api/prv/push", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload) setConfig(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!config?.publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Autorisation refusée par le navigateur.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(config.publicKey),
      });
      const response = await fetch("/api/prv/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setMessage(
        response.ok
          ? "Notifications activées sur cet appareil."
          : "Le serveur a refusé l'abonnement."
      );
    } catch {
      setMessage("L'abonnement a échoué sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }, [config]);

  const testInApp = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMessage("Ce navigateur ne gère pas les notifications.");
      return;
    }
    void Notification.requestPermission().then((permission) => {
      if (permission !== "granted") {
        setMessage("Autorisation refusée par le navigateur.");
        return;
      }
      new Notification("PRV", {
        body: "Les notifications fonctionnent sur cet appareil.",
        icon: "/icon-192.png",
      });
      setMessage("Notification envoyée.");
    });
  }, []);

  const open = tasks.filter((task) => task.status !== "completed");
  const today = todayIso();
  const dueToday = open.filter((task) => task.deadline === today);
  const overdue = open.filter((task) => task.deadline && task.deadline < today);

  return (
    <div className="space-y-5">
      <PrvPanel title="Notifications" subtitle="Rappels calculés à partir de vos vraies échéances.">
        {message && <PrvNotice tone="info">{message}</PrvNotice>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PrvStat label="Échéance aujourd'hui" value={dueToday.length} />
          <PrvStat label="En retard" value={overdue.length} tone={overdue.length > 0 ? "warn" : "muted"} />
          <PrvStat label="Total ouvert" value={open.length} />
        </div>
        <p className="mt-2 text-[11px] text-ink/45">Aujourd&apos;hui : {formatShortDate(today)}.</p>
      </PrvPanel>

      <PrvPanel
        title="Notifications dans l'application"
        subtitle="Fonctionne sans configuration serveur, uniquement dans cet onglet."
        action={
          <Button size="sm" variant="secondary" onClick={testInApp} disabled={busy}>
            <BellRing className="h-3.5 w-3.5" /> Tester
          </Button>
        }
      >
        <p className="text-xs leading-relaxed text-ink/65">
          Le navigateur affiche la notification immédiatement, sans clé ni service worker externe.
          Utile pour vérifier que les rappels ne sont pas bloqués par le système.
        </p>
      </PrvPanel>

      <PrvPanel
        title="Notifications push"
        subtitle="Alertes même lorsque l'onglet est fermé."
        action={
          <Button size="sm" onClick={() => void subscribe()} disabled={busy || !config?.configured || !supported}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Activer
          </Button>
        }
      >
        {config?.configured ? (
          <p className="text-xs leading-relaxed text-ink/65">
            {config.devices} appareil(s) abonné(s). Le service worker sert depuis{" "}
            <code className="rounded bg-ink/10 px-1">/sw.js</code>.
          </p>
        ) : (
          <PrvNotice tone="info">
            Push non configuré. Définissez <code className="rounded bg-ink/10 px-1">PUSH_PUBLIC_KEY</code>,{" "}
            <code className="rounded bg-ink/10 px-1">PUSH_PRIVATE_KEY</code> et{" "}
            <code className="rounded bg-ink/10 px-1">PUSH_SUBJECT</code> côté serveur. La clé privée
            n&apos;est jamais envoyée au navigateur.
          </PrvNotice>
        )}
        {!supported && (
          <p className="mt-2 text-[11px] text-ink/45">
            Ce navigateur ne gère pas Web Push : seule la notification dans l&apos;application est
            disponible.
          </p>
        )}
      </PrvPanel>
    </div>
  );
}
