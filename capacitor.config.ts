const config = {
  appId: 'in.missionuniform.op',
  appName: 'MISSION UNIFORM OP',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: false
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
