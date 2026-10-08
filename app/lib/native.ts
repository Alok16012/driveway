/** True in the Android app builds (`npm run build:mobile`), where each APK bundles only one app. */
export const NATIVE_APP = process.env.NEXT_PUBLIC_NATIVE_APP === "1";
