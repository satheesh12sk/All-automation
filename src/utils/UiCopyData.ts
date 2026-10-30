import type { LangCode } from './languages';

/**
 * Observed on-screen strings per language, keyed by uiCopy key.
 *
 * Values for en/hi/te/kn are copied verbatim from the axl-test app's own i18n dictionaries
 * (same message keys noted in the comments), so they match what the app renders. A string the
 * app shows in English for every language is listed under `en` only; the lookup falls back to
 * English solely for keys marked `englishOnly`.
 *
 * `{number}` / `{milestone}` placeholders are filled by `copyRe(..., { vars })`.
 * Missing keys per language are reported by `npm run lang:check`.
 */
export const UI_COPY_DATA = {
  // ---- Login (LOGIN_*) ----
  guestTab: { en: ['Guest'], hi: ['अतिथि'], te: ['అతిథి'], kn: ['ಅತಿಥಿ'] },
  studentTab: { en: ['Student'], hi: ['छात्र'], te: ['విద్యార్థి'], kn: ['ವಿದ್ಯಾರ್ಥಿ'] },
  loginAsGuest: {
    en: ['Login as Guest'], hi: ['अतिथि के रूप में लॉगिन करें'], te: ['అతిథిగా లాగిన్ చేయండి'], kn: ['ಅತಿಥಿಯಾಗಿ ಲಾಗಿನ್ ಮಾಡಿ'],
  },
  userIdPlaceholder: { en: ['User ID'], hi: ['यूज़र आईडी'], te: ['యూజర్ ఐడి'], kn: ['ಬಳಕೆದಾರ ಐಡಿ'] },
  passwordPlaceholder: { en: ['Password'], hi: ['पासवर्ड'], te: ['పాస్‌వర్డ్'], kn: ['ಪಾಸ್‌ವರ್ಡ್'] },
  loginErrorGrade: { en: ['Select a grade'], hi: ['कक्षा चुनें'], te: ['తరగతి ఎంచుకోండి'], kn: ['ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ'] },
  // Option labels are "Grade 1".."Grade 5" (not translated by the app).
  gradeOption: { en: ['Grade {number}'], englishOnly: true },

  // ---- Language modal (LOGIN_LANG_MODAL_*) ----
  languageModalDone: { en: ['Done'], hi: ['हो गया'], te: ['పూర్తయింది'], kn: ['ಮುಗಿಯಿತು'] },

  // ---- Audio check (MICCHECK_*) ----
  micGreeting: {
    en: ["Hi! What's your name?"], hi: ['नमस्ते! आपका नाम क्या है?'], te: ['నమస్కారం! మీ పేరు ఏమిటి?'], kn: ['ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಹೆಸರೇನು?'],
  },
  micListening: { en: ["We're listening..."], hi: ['हम सुन रहे हैं...'], te: ['మేము వింటున్నాము...'], kn: ['ನಾವು ಕೇಳುತ್ತಿದ್ದೇವೆ...'] },
  micNotCaught: { en: ["Didn't catch that!"], hi: ['सुनाई नहीं दिया!'], te: ['అది వినిపించలేదు!'], kn: ['ಅದು ಕೇಳಿಸಲಿಲ್ಲ!'] },
  micNiceToMeet: {
    en: ['Nice to meet you!'], hi: ['आपसे मिलकर अच्छा लगा!'], te: ['మిమ్మల్ని కలవడం సంతోషం!'], kn: ['ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿ ಸಂತೋಷ!'],
  },
  micError: {
    en: ["We can't hear you. Make sure your microphone is on."],
    hi: ['हमें आपकी आवाज़ सुनाई नहीं दे रही। कृपया देखें कि आपका माइक्रोफ़ोन चालू है।'],
    te: ['మీరు మాకు వినిపించడం లేదు. మీ మైక్రోఫోన్ ఆన్‌లో ఉందో చూడండి.'],
    kn: ['ನಮಗೆ ನೀವು ಕೇಳಿಸುತ್ತಿಲ್ಲ. ನಿಮ್ಮ ಮೈಕ್ರೊಫೋನ್ ಆನ್ ಇದೆಯೇ ಎಂದು ಪರಿಶೀಲಿಸಿ.'],
  },
  micTryAgain: { en: ['Try again'], hi: ['फिर कोशिश करें'], te: ['మళ్ళీ ప్రయత్నించండి'], kn: ['ಇನ್ನೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ'] },

  // ---- Discovery (ASSESSMENT_* / DISCOVER_*) ----
  startAssessment: {
    en: ['Start Assessment'], hi: ['असेसमेंट शुरू करें'], te: ['మూల్యాంకనాన్ని ప్రారంభించండి'], kn: ['ಮೌಲ್ಯಮಾಪನ ಪ್ರಾರಂಭಿಸಿ'],
  },
  findStartingPoint: {
    en: ["Let's find your starting point!"], hi: ['चलिए आपकी शुरुआत का स्तर पता करते हैं!'],
    te: ['మీ ప్రారంభ స్థాయిని కనుగొందాం!'], kn: ['ನಿಮ್ಮ ಪ್ರಾರಂಭದ ಹಂತವನ್ನು ಕಂಡುಹಿಡಿಯೋಣ!'],
  },
  demoBanner: {
    en: ["Demo — this one doesn't count"], hi: ['डेमो — इसकी गिनती नहीं होगी'], te: ['డెమో — ఇది లెక్కలోకి రాదు'], kn: ['ಡೆಮೊ — ಇದು ಲೆಕ್ಕಕ್ಕೆ ಬರುವುದಿಲ್ಲ'],
  },
  contentSentences: { en: ['SENTENCES'], hi: ['वाक्य'], te: ['వాక్యాలు'], kn: ['ವಾಕ್ಯಗಳು'] },
  contentWords: { en: ['WORDS'], hi: ['शब्द'], te: ['పదాలు'], kn: ['ಪದಗಳು'] },
  contentLetters: { en: ['SOUNDS & LETTERS'], hi: ['ध्वनियाँ और अक्षर'], te: ['శబ్దాలు మరియు అక్షరాలు'], kn: ['ಶಬ್ದಗಳು ಮತ್ತು ಅಕ್ಷರಗಳು'] },
  setComplete: {
    en: ['Set {number} Complete'], hi: ['सेट {number} पूरा हुआ'], te: ['సెట్ {number} పూర్తయింది'], kn: ['ಸೆಟ್ {number} ಪೂರ್ಣಗೊಂಡಿದೆ'],
  },
  startSet: {
    en: ['START SET {number}'], hi: ['सेट {number} शुरू करें'], te: ['సెట్ {number} ప్రారంభించండి'], kn: ['ಸೆಟ್ {number} ಪ್ರಾರಂಭಿಸಿ'],
  },
  continueLabel: { en: ['Continue'], hi: ['जारी रखें'], te: ['కొనసాగించండి'], kn: ['ಮುಂದುವರಿಸಿ'] },
  evaluating: {
    en: ['Evaluating your responses...'], hi: ['आपके उत्तरों का मूल्यांकन हो रहा है...'],
    te: ['మీ సమాధానాలను మూల్యాంకనం చేస్తున్నాము...'], kn: ['ನಿಮ್ಮ ಉತ್ತರಗಳನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ...'],
  },
  placementComplete: { en: ['ASSESSMENT COMPLETE'], hi: ['असेसमेंट पूरा हुआ'], te: ['మూల్యాంకనం పూర్తయింది'], kn: ['ಮೌಲ್ಯಮಾಪನ ಪೂರ್ಣಗೊಂಡಿದೆ'] },
  placementHeading: {
    en: ["You're ready to begin!"], hi: ['आप शुरू करने के लिए तैयार हैं!'], te: ['మీరు ప్రారంభించడానికి సిద్ధంగా ఉన్నారు!'], kn: ['ನೀವು ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧರಾಗಿದ್ದೀರಿ!'],
  },
  // Hard-coded English in the app (not routed through i18n).
  viewMyRoadmap: { en: ['VIEW MY ROADMAP'], englishOnly: true },

  // ---- Roadmap / F1 entry (ROADMAP_* / MILESTONE_INTRO_CTA) ----
  startMilestoneActivity: {
    en: ['Start {milestone} Activity'], hi: ['{milestone} गतिविधि शुरू करें'], te: ['{milestone} కార్యకలాపం ప్రారంభించండి'], kn: ['{milestone} ಚಟುವಟಿಕೆ ಪ್ರಾರಂಭಿಸಿ'],
  },
  // Hard-coded English in the app ("START L1 ➔" on the /learn step intro).
  startStep: { en: ['START {step}'], englishOnly: true },
} satisfies Record<string, Partial<Record<LangCode, string[]>> & { englishOnly?: boolean }>;
