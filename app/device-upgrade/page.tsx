"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => { open: () => void };
  }
}

export default function DeviceUpgradePage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const init = async () => {
      const sb = supabaseBrowser();
      if (!sb) {
        setMessage("Login service is unavailable. Please try again later.");
        setLoading(false);
        return;
      }
      const { data } = await sb.auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace("/login?next=%2Fdevice-upgrade");
        return;
      }
      const pending = window.localStorage.getItem("mu_pending_device_id") || "";
      if (!pending) {
        setMessage("No additional device is waiting for registration. Please login again on the device you want to add.");
        setLoading(false);
        return;
      }
      setDeviceId(pending);
      setEmail(data.session.user.email || "");
      setLoading(false);
    };
    void init();
    return () => { active = false; };
  }, [router]);

  async function leaveUpgrade() {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    window.localStorage.removeItem("mu_pending_device_id");
    router.replace("/login");
  }

  async function startPayment() {
    if (!deviceId || busy) return;
    const sb = supabaseBrowser();
    if (!sb) {
      setMessage("Login service is unavailable.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Your session expired. Please login again.");

      const orderResponse = await fetch("/api/device-session/payment/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ device_id: deviceId }),
        cache: "no-store",
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Could not start payment.");

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Payment window could not load. Check your internet and try again."));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error("Payment service is unavailable.");

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.order_id,
        prefill: { email },
        theme: { color: "#172554" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyResponse = await fetch("/api/device-session/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                device_id: deviceId,
              }),
              cache: "no-store",
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verified.error || "Payment verification failed.");
            window.localStorage.setItem("mu_student_device_id", deviceId);
            window.localStorage.removeItem("mu_pending_device_id");
            router.replace("/dashboard");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Payment verification failed. Please contact support.");
            setBusy(false);
          }
        },
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start payment.");
      setBusy(false);
    }
  }

  return (
    <main className="mu-password-page">
      <section className="auth-card">
        <span className="eyebrow">DEVICE SECURITY · MISSION UNIFORM OP</span>
        <h1>Register Additional Device</h1>
        <p>Your account already uses its two free device slots. Pay once to register this additional device.</p>
        <div style={{ margin: "22px 0", padding: "20px", border: "1px solid #e5d4a5", borderRadius: 14, background: "#fffbef", textAlign: "center" }}>
          <div style={{ color: "#806018", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>ONE-TIME DEVICE REGISTRATION</div>
          <div style={{ color: "#172554", fontSize: 42, fontWeight: 900, margin: "5px 0" }}>₹19</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Lifetime registration for this device</div>
        </div>
        <ul style={{ color: "#475569", fontSize: 13, lineHeight: 1.9, paddingLeft: 20 }}>
          <li>First 2 devices are free.</li>
          <li>₹19 one-time payment for each extra device.</li>
          <li>Payment is verified securely before activation.</li>
        </ul>
        {message && <p className="notice" role="status">{message}</p>}
        <button className="btn primary full" type="button" onClick={() => void startPayment()} disabled={loading || busy || !deviceId}>
          {loading ? "Checking account…" : busy ? "Processing…" : "Pay ₹19 & Register Device"}
        </button>
        <p className="auth-switch"><button type="button" onClick={() => void leaveUpgrade()} style={{ border: 0, background: "transparent", color: "#9a7415", cursor: "pointer" }}>Sign out and return to Login</button></p>
      </section>
    </main>
  );
}
