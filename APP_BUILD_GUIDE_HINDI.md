# MISSION UNIFORM OP — Android App Build Guide

## Existing project
This repository is the existing Next.js + React + Supabase website. The Android app will use Capacitor to package the same student web experience. The website and app share Supabase authentication, question bank, test history and job alerts.

## Important production requirement
The current README describes some CBT and admin areas as starter/demo or placeholders. Wrapping a website does not complete those backend features. Verify server-side grading, Supabase role checks, student access and all test routes before public release.

## Android wrapper
- App ID: in.missionuniform.op
- App name: MISSION UNIFORM OP
- Capacitor web output: out
- Scheme: HTTPS
- App uses the existing website backend; do not add a separate payment system.
- All student tests remain free. No subscription or payment SDK is included.

## Requirements
- Node.js 22 LTS
- Android Studio (current stable)
- Android SDK and platform tools
- Java version required by the installed Android Gradle Plugin
- A real HTTPS production website URL for the optional hosted/PWA mode

## First-time setup
1. Install dependencies: `npm install`
2. Install Capacitor packages: `npm install @capacitor/core @capacitor/android @capacitor/splash-screen @capacitor/status-bar`
3. Install CLI: `npm install -D @capacitor/cli`
4. Build the local web bundle after configuring Next.js static export support: `npm run build`
5. Add Android: `npx cap add android`
6. Copy assets and web bundle: `npx cap sync android`
7. Open native project: `npx cap open android`
8. In Android Studio, test on a physical Android device and create a signed release AAB.

## Next.js compatibility
The existing Next.js app may use server-side routes, dynamic routes or API routes that cannot run inside a static local Capacitor bundle without a hosted backend. Keep the backend hosted on HTTPS and configure a compatible web build strategy for client routes. Do not blindly set `output: 'export'` until every route and API dependency has been checked. A hosted web deployment inside a Capacitor WebView is an alternative but requires a trusted domain allowlist and proper deep-link/auth handling.

## Security checklist
- Never put Supabase service_role or other private secrets in the Android app.
- Use Supabase anon/publishable key only in the client, protected by RLS.
- Protect admin APIs with server-side role checks.
- Validate and grade exams server-side; do not send correct answers before submission.
- Restrict Android navigation to the official app domain; external links should open in the system browser.
- Add privacy policy, account deletion and support contact.
- Configure HTTPS, backup, monitoring and rate limits.

## App release
- Test login, OTP, test timer, question navigation, submission, results, history, bookmarks and job alerts.
- Verify back button, keyboard, poor network, offline messaging, push permission, screen sizes and accessibility.
- Generate a signed Android App Bundle (AAB) in Android Studio.
- Keep the upload key securely backed up. Never commit keystore passwords or signing files.
- Complete Google Play Console listing, screenshots, content rating, data safety, privacy and app access declarations before release.
