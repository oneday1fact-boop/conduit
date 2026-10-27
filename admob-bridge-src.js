
import { AdMob, MaxAdContentRating } from '@capacitor-community/admob';

const PLATFORM = window.Capacitor?.getPlatform?.();

// Keep test ads enabled during development.
const USE_TEST_ADS = true;

const TEST_REWARDED_AD_ID =
  PLATFORM === 'android'
    ? 'ca-app-pub-3940256099942544/5224354917'
    : 'ca-app-pub-3940256099942544/1712485313';

const ANDROID_REWARDED_AD_ID =
  'ca-app-pub-9967525901358281/7914292147';

const REWARDED_AD_ID =
  USE_TEST_ADS || PLATFORM !== 'android'
    ? TEST_REWARDED_AD_ID
    : ANDROID_REWARDED_AD_ID;

let initialized = false;

async function checkConsent() {
  try {
    let info = await AdMob.requestConsentInfo({
      tagForUnderAgeOfConsent: true
    });

    if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
      info = await AdMob.showConsentForm();
    }

    return Boolean(info.canRequestAds);
  } catch (error) {
    console.warn('Ad consent check failed:', error);
    return false;
  }
}

async function initializeAds() {
  if (initialized) return;

  await AdMob.initialize({
    initializeForTesting: true,
    tagForChildDirectedTreatment: true,
    tagForUnderAgeOfConsent: true,
    maxAdContentRating: MaxAdContentRating.General
  });

  initialized = true;
}

window.ConduitAdMob = {
  async rewardHint() {
    if (!window.Capacitor?.isNativePlatform?.()) {
      throw new Error('Rewarded ads require the native app.');
    }

    if (!(await checkConsent())) {
      throw new Error('Ads are not currently available.');
    }

    await initializeAds();

    await AdMob.prepareRewardVideoAd({
      adId: REWARDED_AD_ID,
      isTesting: true
    });

    const reward = await AdMob.showRewardVideoAd({
      adId: REWARDED_AD_ID
    });

    return Boolean(reward && Number(reward.amount) > 0);
  }
};

