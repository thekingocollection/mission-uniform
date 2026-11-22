"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type SponsorAd = { id:string; title:string; description:string|null; image_url:string|null; target_url:string; placement:string };
export function SponsorBanner({ placement = "global_top" }: { placement?: string }) {
  const path = usePathname();
  const [ad,setAd] = useState<SponsorAd|null>(null);
  useEffect(() => {
    let live = true;
    const selected = placement === "global_top" && path.startsWith("/dashboard") ? "dashboard_top" : placement;
    fetch("/api/sponsor-ads?placement="+encodeURIComponent(selected), { cache:"no-store" })
      .then(r=>r.json()).then(d=>{if(live)setAd(d.ad||null)}).catch(()=>{if(live)setAd(null)});
    return ()=>{live=false};
  },[path,placement]);
  if(!ad)return null;
  return <aside className="mu-sponsor-wrap" aria-label="Sponsored advertisement">
    <a className={ad.image_url ? "mu-sponsor-card has-image" : "mu-sponsor-card"} href={ad.target_url} target="_blank" rel="sponsored noopener noreferrer">
      {ad.image_url ? <img src={ad.image_url} alt="" loading="lazy"/> : <span className="mu-sponsor-icon" aria-hidden="true">✦</span>}
      <span className="mu-sponsor-copy"><small>SPONSORED</small><b>{ad.title}</b>{ad.description&&<span>{ad.description}</span>}</span>
      <span className="mu-sponsor-cta">Learn more ↗</span>
    </a>
  </aside>;
}
