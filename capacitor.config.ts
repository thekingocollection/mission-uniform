import type { CapacitorConfig } from '@capacitor/cli';

const remoteUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const remoteHost = remoteUrl ? new URL(remoteUrl).host : undefined;

const config: CapacitorConfig = {
  appId: 'in.missionuniform.op',
  appName: 'MISSION UNIFORM OP',
  webDir: 'mobile-web',
  server: remoteUrl
    ? {
        url: remoteUrl,
        cleartext: false,
        allowNavigation: [remoteHost!],
      }
    : {
        cleartext: false,
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#08172f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      backgroundColor: '#08172f',
      style: 'DARK',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
