import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function getFirebaseAdminApp() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
  let account: ServiceAccount;
  try {
    account = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error("Firebase service account JSON is missing required fields.");
  }
  const existing = getApps().find((app) => app.name === "mission-uniform-fcm");
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: account.project_id,
  }, "mission-uniform-fcm");
}

export async function sendFcmNotifications(input: {
  tokens: string[];
  title: string;
  body: string;
  url: string;
}) {
  if (!input.tokens.length) return { successCount: 0, failureCount: 0, invalidTokens: [] as string[] };
  const messaging = getMessaging(getFirebaseAdminApp());
  const response = await messaging.sendEachForMulticast({
    tokens: input.tokens,
    notification: { title: input.title, body: input.body },
    data: { title: input.title, body: input.body, url: input.url },
    webpush: {
      fcmOptions: { link: new URL(input.url.startsWith("/") ? input.url : "/notifications", process.env.NEXT_PUBLIC_SITE_URL || "https://mission-uniform.onrender.com").toString() },
      notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
    },
  });
  const invalidTokens: string[] = [];
  response.responses.forEach((result, index) => {
    const code = result.error?.code || "";
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      invalidTokens.push(input.tokens[index]);
    }
  });
  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}
