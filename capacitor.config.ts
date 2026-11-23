const config = {
  // Preserve the existing Android package ID; it must stay stable after Play Store release.
  appId: 'in.missionuniform.op',
  appName: 'MISSION UNIFORM OP',
  webDir: 'www',
  server: {
    // First device-test build loads the existing live Next.js website.
    // The website and its Supabase backend remain independent and unchanged.
    url: 'https://mission-uniform.onrender.com',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['mission-uniform.onrender.com']
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#08172f',
      showSpinner: false
    },
    StatusBar: {
      backgroundColor: '#08172f',
      style: 'DARK'
    }
  }
};

export default config;
