"use client";

export default function PremiumTrialBanner({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "mu-trial-banner mu-trial-banner--compact" : "mu-trial-banner"} aria-label="New student free trial">
      <div className="mu-trial-copy">
        <span className="mu-trial-kicker"><i /> NEW STUDENT BENEFIT</span>
        <h2>24 HOURS OF FREE TRIAL ACCESS</h2>
        <p>Your personal 24-hour trial starts automatically when you create your student account. After it ends, unlock premium subjects with secure online payment.</p>
        <div className="mu-trial-perks"><span>✦ All subjects during trial</span><span>✦ Purchased access stays active</span><span>✦ Secure Razorpay checkout</span></div>
      </div>
      <div className="mu-trial-clock" aria-hidden="true">
        <span>PERSONAL TRIAL</span><strong>24<i>:</i>00<i>:</i>00</strong><small>HRS&nbsp;&nbsp; MIN&nbsp;&nbsp; SEC</small>
      </div>
      <div className="mu-trial-actions"><small>Trial time is calculated separately for every student account.</small></div>
    </section>
  );
}
