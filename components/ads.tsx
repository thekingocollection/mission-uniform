"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AdPlacement = "home_hero" | "article_inline" | "study_material_end" | "result_below" | "footer";
type PlacementConfig = { enabled: boolean; slot_id: string | null };
type PublicAdConfig = {
  enabled: boolean;
  publisherId: string | null;
  maxAdsPerPage: number;
  placements: Record<AdPlacement, PlacementConfig>;
};

const defaultConfig: PublicAdConfig = {
  enabled: false,
  publisherId: null,
  maxAdsPerPage: 3,
  placements: {
    home_hero: { enabled: true, slot_id: null },
    article_inline: { enabled: true, slot_id: null },
    study_material_end: { enabled: true, slot_id: null },
    result_below: { enabled: true, slot_id: null },
    footer: { enabled: true, slot_id: null },
  },
};

type AdsContextValue = {
  config: PublicAdConfig;
  consent: boolean;
  ready: boolean;
  examActive: boolean;
  claim: (placement: AdPlacement) => boolean;
  setConsent: (value: boolean) => void;
};
const AdsContext = createContext<AdsContextValue | null>(null);

export function AdsProvider({ children, examActive = false }: { children: React.ReactNode; examActive?: boolean }) {
  const pathname = usePathname();
  const routeIsExam = /^\/(tests|mock|weekly-grand-test)(\/|$)/.test(pathname || "");
  const blockedForExam = examActive || routeIsExam;
  const [config, setConfig] = useState<PublicAdConfig>(defaultConfig);
  const [consent, setConsentState] = useState(false);
  const [ready, setReady] = useState(false);
  const used = useRef<Set<AdPlacement>>(new Set());

  useEffect(() => { used.current.clear(); }, [pathname]);

  useEffect(() => {
    try {
      setConsentState(window.localStorage.getItem("muop_ads_consent") === "accepted");
    } catch {}
    fetch("/api/ads/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setConfig({ ...defaultConfig, ...data, placements: { ...defaultConfig.placements, ...(data.placements || {}) } }); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setConsent = useCallback((value: boolean) => {
    setConsentState(value);
    try { window.localStorage.setItem("muop_ads_consent", value ? "accepted" : "rejected"); } catch {}
  }, []);

  const claim = useCallback((placement: AdPlacement) => {
    if (blockedForExam || !config.enabled || !consent || !config.publisherId) return false;
    const item = config.placements[placement];
    if (!item?.enabled || !item.slot_id || used.current.has(placement) || used.current.size >= config.maxAdsPerPage) return false;
    used.current.add(placement);
    return true;
  }, [config, consent, blockedForExam]);

  const value = useMemo(() => ({ config, consent, ready, examActive: blockedForExam, claim, setConsent }), [config, consent, ready, blockedForExam, claim, setConsent]);
  return <AdsContext.Provider value={value}>
    {children}
    {ready && config.enabled && consent && config.publisherId && !blockedForExam && (
      <Script id="muop-adsense" async strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.publisherId}`} />
    )}
    {ready && config.enabled && !consent && !blockedForExam && <AdConsentNotice onChoice={setConsent} />}
  </AdsContext.Provider>;
}

export function AdSlot({ placement, label = "Advertisement", className = "" }: {
  placement: AdPlacement; label?: string; className?: string;
}) {
  const ctx = useContext(AdsContext);
  const [shown, setShown] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx || !ctx.ready) return;
    const p = ctx.config.placements[placement];
    if (ctx.claim(placement)) {
      setSlot(p.slot_id);
      setShown(true);
    }
  }, [ctx, placement]);

  if (!ctx || !shown || !slot || !ctx.config.publisherId || ctx.examActive) return null;
  return <aside className={`muop-ad-wrap ${className}`} aria-label={label}>
    <span className="muop-ad-label">ADVERTISEMENT</span>
    <ins className="adsbygoogle muop-ad"
      style={{ display: "block", minHeight: 90 }}
      data-ad-client={ctx.config.publisherId}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true" />
    <AdInitializer />
  </aside>;
}

function AdInitializer() {
  useEffect(() => {
    try { ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle || []).push({}); }
    catch { /* Ad blockers or an unavailable ad request should fail quietly. */ }
  }, []);
  return null;
}

function AdConsentNotice({ onChoice }: { onChoice: (value: boolean) => void }) {
  return <div className="muop-consent" role="dialog" aria-label="Advertisement preferences">
    <div><strong>Advertisement preferences</strong><p>Allow ads to help keep all Mission Uniform OP lessons and mock tests free. You can continue without accepting.</p></div>
    <div className="muop-consent-actions">
      <button onClick={() => onChoice(false)} className="muop-consent-secondary">No thanks</button>
      <button onClick={() => onChoice(true)} className="muop-consent-primary">Allow ads</button>
    </div>
  </div>;
}


export function PersonalAdSlot({ placement, className = "" }: { placement: AdPlacement; className?: string }) {
  const ctx = useContext(AdsContext);
  const [campaign, setCampaign] = useState<null | { id: string; title: string; description: string | null; image_url: string | null; destination_url: string; button_text: string | null }>(null);

  useEffect(() => {
    if (!ctx?.ready || ctx.examActive) return;
    let cancelled = false;
    fetch(`/api/personal-ads?placement=${encodeURIComponent(placement)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data?.campaign) setCampaign(data.campaign); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ctx?.ready, ctx?.examActive, placement]);

  if (!ctx?.ready || ctx.examActive || !campaign) return null;
  const click = () => {
    const body = JSON.stringify({ campaign_id: campaign.id, placement });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/personal-ads/click", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/personal-ads/click", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  };
  return <aside className={`muop-personal-ad ${className}`} aria-label="Sponsored promotion">
    <div className="muop-personal-ad-label">SPONSORED</div>
    <a href={campaign.destination_url} target="_blank" rel="sponsored nofollow noopener noreferrer" onClick={click}>
      {campaign.image_url ? <img src={campaign.image_url} alt="" loading="lazy" /> : null}
      <div className="muop-personal-ad-copy">
        <strong>{campaign.title}</strong>
        {campaign.description ? <p>{campaign.description}</p> : null}
        <span>{campaign.button_text || "Learn more"} ↗</span>
      </div>
    </a>
  </aside>;
}
