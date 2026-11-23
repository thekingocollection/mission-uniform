# Mission Uniform — Android / Play Store starter

This branch prepares the existing Mission Uniform Next.js website for an Android shell using Capacitor. The website and Supabase backend remain the source of truth.

## App identity
- Display name: MISSION UNIFORM OP
- Existing Android application ID: `in.missionuniform.op` (preserved; do not change after publishing)
- Website: https://mission-uniform.onrender.com
- Android wrapper: Capacitor 7

## Current status
This is the **Android wrapper setup**, not a completed APK/AAB and not a Play-Store-approved app. The first device-test build loads the hosted website inside a Capacitor Android shell. The public website is not replaced or modified by this wrapper setup.

A simple remote website wrapper may not meet Google Play's minimum functionality expectations. Before production submission, we must add and test meaningful mobile functionality and app-specific UX, including robust Android back/navigation behavior, offline/error handling, push notifications (with consent), and full real-device testing. Do not submit a thin wrapper as a finished app.

## Build prerequisites
- Node.js 20+
- Android Studio and Android SDK
- A compatible JDK (use the version required by the installed Android Gradle Plugin)
- Google Play Console developer account to publish

## Generate the Android project on a computer
1. Clone this repository and checkout branch `android-playstore-starter`.
2. Run `npm install`.
3. Run `npm run android:add` once to generate the native Android project.
4. Run `npm run android:sync` after web/config/plugin changes.
5. Run `npm run android:open` to open Android Studio.
6. Connect a physical Android phone and test all student flows.
7. Configure final app icon, splash assets, version code/name, permissions and signing.
8. Build a signed Android App Bundle (.aab); test it with Play Console internal testing before production release.

## Security
- Never put Supabase service-role keys or private API secrets in the Android app.
- Use only public/publishable client credentials; enforce authorization and admin permissions on the server/database.
- Review account deletion, privacy policy, Data safety and consent requirements before submission.

## Before publishing checklist
- Verify signup/login, subject and chapter tests, daily tests, previous papers, results, bookmarks, job alerts and admin-protected routes.
- Confirm student data is protected and admin pages cannot be accessed by ordinary users.
- Test network loss, slow network, external links, Android back button and app resume.
- Publish a privacy policy and provide support contact details.
- Complete Play Console app content, Data safety, target audience and content-rating forms accurately.
- Check the current Play Console target API and testing requirements at submission time.
