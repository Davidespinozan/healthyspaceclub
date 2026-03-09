import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.healthyspaceclub.app',
  appName: 'Healthy Space Club',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    CapacitorHealth: {
      // Permissions solicitados al usuario
      read: ['stepCount', 'activeEnergyBurned', 'bodyMass', 'sleepAnalysis'],
    },
  },
};

export default config;
