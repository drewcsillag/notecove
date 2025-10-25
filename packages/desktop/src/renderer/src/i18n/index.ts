/**
 * i18n Configuration
 *
 * Using react-i18next for internationalization.
 * Currently supports English only, prepared for future localization.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en,
      },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  })
  .catch((error: Error) => {
    console.error('i18n initialization failed:', error);
  });

export default i18n;
