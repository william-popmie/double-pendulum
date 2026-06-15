import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string,
  person_profiles: 'identified_only',
  capture_pageview: false,
  enable_recording_console_log: false,
  capture_exceptions: true,
});

export default posthog;
