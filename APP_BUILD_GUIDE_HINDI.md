# MISSION UNIFORM OP — Android Native-style App

This project adds an Android app shell to the existing Next.js + Supabase platform using Capacitor 7. It is a hybrid native Android app (native Android container and plugins with the existing web application as its UI), not a separate Kotlin/Jetpack Compose rewrite. This avoids maintaining two student platforms and keeps the website and app on the same Supabase backend.

## App identity
- Display name: MISSION UNIFORM OP
- Android application ID: `in.missionuniform.op`
- Distribution targets: APK for direct installation and signed AAB for Google Play
- Theme: royal navy `#08172f` with gold accents
- Capacitor 7 Android runtime

## Critical: production website URL is required
The Next.js project uses server routes, Supabase auth and dynamic pages. It must remain deployed on HTTPS. Do NOT attempt to package the entire Next.js server as a static Android bundle. At build time, provide the real deployed website URL:
`CAPACITOR_SERVER_URL=https://YOUR-REAL-PRODUCTION-DOMAIN`

Capacitor opens that trusted HTTPS website inside the native Android shell. Replace the placeholder with the actual verified production URL before creating release builds. Do not put Supabase service-role keys in this app.

## Local development (Windows)
1. Install Node.js 22 LTS (compatible with this repository's Next.js 15 dependencies).
2. Install Android Studio and Android SDK Platform Tools.
3. Clone this repository and run `npm install`.
4. Set the URL in PowerShell for the current terminal:
   `$env:CAPACITOR_SERVER_URL="https://YOUR-REAL-PRODUCTION-DOMAIN"`
5. Generate the native Android project once:
   `npx cap add android`
6. Sync native plugins and configuration:
   `npx cap sync android`
7. Open Android Studio:
   `npx cap open android`
8. Connect a real Android phone with USB debugging enabled and press Run.

If the project has not yet been deployed, first deploy the Next.js site to its production HTTPS domain and verify login, test pages, submission, job alerts and Supabase redirects in a mobile browser.

## Build APK
From the project root, with `CAPACITOR_SERVER_URL` set:
```powershell
npm install
npx cap add android
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```
Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

For a release APK, configure signing first; never distribute a debug-signed APK as a production release.

## Build Play Store AAB
1. In Android Studio, use Build > Generate Signed Bundle / APK > Android App Bundle.
2. Create a new upload keystore and keep it in a secure backup outside this repository.
3. Sign the release AAB with that upload key.
4. Upload the AAB to Google Play Console internal testing first.
5. Complete app access, privacy policy, Data safety, content rating, target API and store listing declarations.

Never commit `.jks`, `.keystore`, passwords or signing secrets to GitHub.

## GitHub Actions
The workflow `.github/workflows/android-build.yml` builds and uploads a debug APK when manually triggered. Add repository secret `CAPACITOR_SERVER_URL` with the real HTTPS website URL.

To also build and upload a signed Play Store AAB, add all four signing secrets in GitHub repository Settings > Secrets and variables > Actions:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

If the signing secrets are absent, the APK job still runs and the AAB step is skipped. The upload keystore must be generated and securely backed up by the app owner. Never commit the keystore or passwords.

## Features and limitations
- Existing Next.js pages, Supabase auth, mock tests and job alerts are reused.
- Native splash screen, status bar, keyboard resizing, browser and network plugins are included.
- All student subject tests and mock tests remain free. No payment SDK, subscription or paywall is added.
- Push notifications require a Firebase project, Android `google-services.json`, FCM configuration and server-side token delivery. They are not enabled by this wrapper alone.
- Offline exam mode requires a separate tested local question cache and secure attempt synchronization; do not promise it until implemented.
- The repository README currently identifies some areas as demo or admin placeholders. Capacitor packaging does not magically complete those server-side workflows.

## Release checklist
- Verify actual production domain and HTTPS.
- Verify OTP login, session persistence, logout and password/OTP redirects inside Android.
- Verify all CBT routes, server-side grading and attempt history.
- Verify Android back navigation, keyboard, network-loss recovery and external links.
- Test on at least one low-end Android phone and one recent Android phone.
- Add privacy policy and account deletion route; complete Google Play Data safety.
- Test APK install/update and internal-track AAB before public rollout.
