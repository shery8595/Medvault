# MedVault Android APK (web download)

The landing page **Download APK** button serves `medvault.apk` from this folder.

## Refresh after building

```bash
npm run mobile:apk:debug
```

This builds `android/app/build/outputs/apk/debug/app-debug.apk` and copies it to `public/downloads/medvault.apk` for Vite/Vercel static hosting.

## Optional external hosting

Set `VITE_ANDROID_APK_URL` to a full HTTPS URL (GitHub Release, S3, etc.) if you prefer not to commit the binary.
