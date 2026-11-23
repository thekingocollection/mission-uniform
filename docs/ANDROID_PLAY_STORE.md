# Mission Uniform — Android / Play Store starter

This branch adds the initial Capacitor Android wrapper configuration while keeping the existing Next.js website and Supabase backend as the source of truth.

## App identity
- Display name: Mission Uniform
- Android application ID: `com.thekingocollection.missionuniform`
- Website: https://mission-uniform.onrender.com
- Android wrapper: Capacitor 7

## Important status
This is the **Android wrapper starter**, not a finished or Play-Store-approved app. The first version loads the existing hosted website inside a Capacitor Android shell. The website remains unchanged and continues to run independently.

A remote-site wrapper is useful for an initial device test, but Google Play may reject apps that provide only a thin website view or have limited mobile functionality. Before production submission, add and test meaningful native/mobile features (for example push notifications, proper Android back/navigation behavior, offline/error handling and app-specific UX), complete privacy/data-safety disclosures, and verify all student/admin flows on real devices.

## Build prerequisites
- Node.js 20+
- Android Studio with Android SDK
- Java version supported by the installed Android Gradle Plugin
- A Google Play Console developer account for publishing

## Build on a computer
1. Clone this repository and checkout `android-playstore-starter`.
2. Run `npm install`.
3. Run `npm run android:add` once to generate the native Android project.
4. Run `npm run android:sync` after web/config/plugin changes.
5. Run `npm run android:open` to open Android Studio.
6. In Android Studio, test on a physical Android phone and fix any compatibility issues.
7. Configure the final app icon, splash screen, version code/name, permissions and signing.
8. Build a signed Android App Bundle (.aab) and test it through Play Console's internal testing track before production release.

## Do not change casually
The application ID `com.thekingocollection.missionuniform` becomes the permanent Play Store identity after publishing. Keep it stable. Never put Supabase service-role keys or other private secrets in the Android app. The app must use only public/publishable client credentials and server-side authorization.

## Before publishing checklist
- Confirm privacy policy URL and contact/support details.
- Complete Play Console app content, Data safety, target audience and content-rating forms accurately.
- Verify account deletion/data deletion requirements if users can create accounts.
- Test signup/login, mock tests, result saving, job alerts, notifications, external links and Android back behavior.
- Add push notification consent and a secure notification implementation if push is enabled.
- Review Play Console's current target API, testing and developer verification requirements at submission time.
