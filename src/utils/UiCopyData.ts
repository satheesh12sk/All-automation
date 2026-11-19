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
  // LOGIN_BTN_STUDENT
  loginAsStudent: {
    en: ['Login as Student'], hi: ['छात्र के रूप में लॉगिन करें'], te: ['విద్యార్థిగా లాగిన్ చేయండి'], kn: ['ವಿದ್ಯಾರ್ಥಿಯಾಗಿ ಲಾಗಿನ್ ಮಾಡಿ'],
  },
  // LOGIN_GRADE_PLACEHOLDER (first option of the Grade dropdown)
  gradePlaceholder: { en: ['Select Grade'], hi: ['कक्षा चुनें'], te: ['తరగతి ఎంచుకోండి'], kn: ['ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ'] },
  userIdPlaceholder: { en: ['User ID'], hi: ['यूज़र आईडी'], te: ['యూజర్ ఐడి'], kn: ['ಬಳಕೆದಾರ ಐಡಿ'] },
  passwordPlaceholder: { en: ['Password'], hi: ['पासवर्ड'], te: ['పాస్‌వర్డ్'], kn: ['ಪಾಸ್‌ವರ್ಡ್'] },
  loginErrorGrade: { en: ['Select a grade'], hi: ['कक्षा चुनें'], te: ['తరగతి ఎంచుకోండి'], kn: ['ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ'] },
  // Option labels "Grade 1".."Grade 5" (LOGIN_GRADE_OPTION), translated once the login pill is switched.
  gradeOption: { en: ['Grade {number}'], hi: ['कक्षा {number}'], te: ['తరగతి {number}'], kn: ['ತರಗತಿ {number}'] },

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
  // DISCOVER_DEMO_ITEM_TEXT (the demo item before Set 1)
  demoItemText: { en: ['This is how it works.'], hi: ['यह ऐसे काम करता है।'], te: ['ఇది ఇలా పని చేస్తుంది.'], kn: ['ಇದು ಹೀಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ.'] },
  // COMMON_INSTRUCTION_LANGUAGE (header menu)
  instructionLanguage: { en: ['Instruction Language'], hi: ['निर्देश भाषा'], te: ['సూచనా భాష'], kn: ['ಸೂಚನಾ ಭಾಷೆ'] },
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
  // ---- Foundation F1–F3 games (Letter Train / Hunt / Launcher, Memory Challenge) ----
  // Copied from the app's i18n dictionaries (bundle keys in each comment); trailing "➜" dropped.
  // FOUNDATION_COMPLETE_TITLE
  foundationComplete: { en: ['Foundation {number} Complete!'], hi: ['फाउंडेशन {number} पूरा हुआ!'], te: ['ఫౌండేషన్ {number} పూర్తయింది!'], kn: ['ಫೌಂಡೇಶನ್ {number} ಪೂರ್ಣಗೊಂಡಿದೆ!'] },
  // MECHANIC_NAME_LETTER_TRAIN
  mechanicLetterTrain: { en: ['Letter Train'], hi: ['अक्षर ट्रेन'], te: ['అక్షర రైలు'], kn: ['ಅಕ್ಷರ ರೈಲು'] },
  // MECHANIC_NAME_LETTER_HUNT
  mechanicLetterHunt: { en: ['Letter Hunt'], hi: ['अक्षर खोज'], te: ['అక్షర వేట'], kn: ['ಅಕ್ಷರ ಬೇಟೆ'] },
  // MECHANIC_NAME_LETTER_LAUNCHER
  mechanicLetterLauncher: { en: ['Letter Launcher'], hi: ['अक्षर लॉन्चर'], te: ['అక్షర లాంచర్'], kn: ['ಅಕ್ಷರ ಲಾಂಚರ್'] },
  // MECHANIC_NAME_BARAKHADI (F2 learn steps in hi/te/kn; English F2 uses Letter Train)
  mechanicBarakhadi: { en: ['Barakhadi'], hi: ['बारहखड़ी'], te: ['గుణింతాలు'], kn: ['ಕಾಗುಣಿತ'] },
  // LISTEN
  barakhadiListen: { en: ['Listen'], hi: ['सुनें'], te: ['వినండి'], kn: ['ಕೇಳಿ'] },
  // NEXT
  barakhadiNext: { en: ['Next'], hi: ['आगे'], te: ['తదుపరి'], kn: ['ಮುಂದೆ'] },
  // LETTER_HUNT_FIND_LETTER
  letterHuntFind: { en: ['Find the letter'], hi: ['अक्षर खोजो'], te: ['అక్షరాన్ని కనుగొనండి'], kn: ['ಅಕ್ಷರವನ್ನು ಹುಡುಕಿ'] },
  // SPEAK
  letterTrainSpeak: { en: ['Speak'], hi: ['बोलें'], te: ['మాట్లాడండి'], kn: ['ಮಾತನಾಡಿ'] },
  // LETTER_LAUNCHER_MATCH
  launcherMatch: { en: ['Match'], hi: ['मेल खाता है'], te: ['సరిపోతుంది'], kn: ['ಹೊಂದಿಕೆ ಆಗುತ್ತದೆ'] },
  // LETTER_LAUNCHER_NO_MATCH
  launcherNoMatch: { en: ['No match'], hi: ['मेल नहीं खाता'], te: ['సరిపోదు'], kn: ['ಹೊಂದಿಕೆ ಆಗುವುದಿಲ್ಲ'] },
  // MEMORY_CHALLENGE_REMEMBER
  memoryRemember: { en: ['Remember the sequence'], hi: ['क्रम याद रखो'], te: ['క్రమాన్ని గుర్తుపెట్టుకోండి'], kn: ['ಅನುಕ್ರಮವನ್ನು ನೆನಪಿನಲ್ಲಿಡಿ'] },
  // MEMORY_CHALLENGE_REPEAT
  memoryRepeat: { en: ['Repeat the sequence'], hi: ['क्रम दोहराओ'], te: ['క్రమాన్ని పునరావృతం చేయండి'], kn: ['ಅನುಕ್ರಮವನ್ನು ಪುನರಾವರ್ತಿಸಿ'] },
  // MEMORY_CHALLENGE_NEED_PERCENT
  memoryNeedPercent: { en: ['You need at least {percent}% to continue'], hi: ['आगे बढ़ने के लिए कम से कम {percent}% चाहिए'], te: ['కొనసాగడానికి కనీసం {percent}% కావాలి'], kn: ['ಮುಂದುವರಿಯಲು ಕನಿಷ್ಠ {percent}% ಬೇಕು'] },
  // COMMON_CONTINUE / ASSESSMENT_DIALOG_CONTINUE
  gameContinue: { en: ['Continue'], hi: ['जारी रखें'], te: ['కొనసాగించండి'], kn: ['ಮುಂದುವರಿಸಿ'] },
  // SUCCESS_NEXT_LEVEL
  gameNextLevel: { en: ['Next Level'], hi: ['अगला स्तर'], te: ['తదుపరి స్థాయి'], kn: ['ಮುಂದಿನ ಹಂತ'] },
  // MAIN_LAYOUT_START_GAME
  gameStart: { en: ['Start Game'], hi: ['गेम शुरू करें'], te: ['గేమ్ ప్రారంభించండి'], kn: ['ಆಟವನ್ನು ಪ್ರಾರಂಭಿಸಿ'] },
  // MAIN_LAYOUT_PRACTICE_ARROW
  gamePractice: { en: ['Practice'], hi: ['प्रैक्टिस'], te: ['సాధన'], kn: ['ಅಭ್ಯಾಸ'] },
  // PLAY_AGAIN
  gamePlayAgain: { en: ['Play Again'], hi: ['फिर खेलें'], te: ['మళ్ళీ ఆడు'], kn: ['ಮತ್ತೆ ಆಡು'] },

  // ---- /learn step intro and Mastery M4–M9 (Read Aloud, Self-paced Reading, Showcase) ----
  // Copied from the app's i18n dictionaries (bundle keys in each comment). Trailing "➔" / "🎉"
  // are dropped: labels are matched anywhere in the button or screen text.
  // STEP_INTRO_START
  startStep: { en: ['START {step}'], hi: ['{step} शुरू करें'], te: ['{step} ప్రారంభించండి'], kn: ['{step} ಪ್ರಾರಂಭಿಸಿ'] },
  // MECHANIC_NAME_READ_ALOUD / RAL_STEP_KIND
  masteryReadAloudStep: { en: ['Read Aloud'], hi: ['ज़ोर से पढ़ें', 'ज़ोर से पढ़ना'], te: ['బిగ్గరగా చదవండి', 'గట్టిగా చదవడం'], kn: ['ಗಟ್ಟಿಯಾಗಿ ಓದಿ', 'ಗಟ್ಟಿಯಾಗಿ ಓದು'] },
  // RAL_TIME_TO_READ
  masteryTimeToRead: { en: ['⏱ {seconds}s'], hi: ['⏱ {seconds} सेकंड'], te: ['⏱ {seconds} సెకన్లు'], kn: ['⏱ {seconds} ಸೆಕೆಂಡ್'] },
  // RAL_TAP_MIC
  masteryTapMic: { en: ['Tap the mic, then read'], hi: ['माइक दबाओ, फिर पढ़ो'], te: ['మైక్ నొక్కి, తర్వాత చదవండి'], kn: ['ಮೈಕ್ ಒತ್ತಿ, ನಂತರ ಓದಿ'] },
  // RAL_DONE_READING
  masteryDoneReading: { en: ['Done reading'], hi: ['पढ़ना पूरा'], te: ['చదవడం పూర్తయింది'], kn: ['ಓದಿ ಮುಗಿಯಿತು'] },
  // RAL_PROMPT_TRY1
  masteryPromptTry1: { en: ['Read this aloud'], hi: ['इसे ज़ोर से पढ़ो'], te: ['దీన్ని గట్టిగా చదవండి'], kn: ['ಇದನ್ನು ಗಟ್ಟಿಯಾಗಿ ಓದಿ'] },
  // RAL_PROMPT_TRY2
  masteryPromptTry2: { en: ['Try once more — watch the red words'], hi: ['एक बार फिर कोशिश करो — लाल शब्दों पर ध्यान दो'], te: ['మరోసారి ప్రయత్నించండి — ఎరుపు పదాలను గమనించండి'], kn: ['ಇನ್ನೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ — ಕೆಂಪು ಪದಗಳನ್ನು ಗಮನಿಸಿ'] },
  // RAL_TRY
  masteryTry: { en: ['Try {attempt}'], hi: ['कोशिश {attempt}'], te: ['ప్రయత్నం {attempt}'], kn: ['ಪ್ರಯತ್ನ {attempt}'] },
  // RAL_FINAL_TRY
  masteryFinalTry: { en: ['Final try'], hi: ['आख़िरी कोशिश'], te: ['చివరి ప్రయత్నం'], kn: ['ಕೊನೆಯ ಪ್ರಯತ್ನ'] },
  // RAL_NEXT_ARROW / SPR_NEXT
  masteryNext: { en: ['NEXT'], hi: ['आगे'], te: ['తర్వాత'], kn: ['ಮುಂದೆ'] },
  // RAL_SUMMARY_CONTINUE / SPR_CONTINUE / RAL_SC_CONTINUE
  masteryContinue: { en: ['CONTINUE'], hi: ['आगे बढ़ो'], te: ['కొనసాగండి'], kn: ['ಮುಂದುವರಿಸಿ'] },
  // RAL_TRY_AGAIN_ARROW
  masteryTryAgain: { en: ['TRY AGAIN'], hi: ['फिर कोशिश करो'], te: ['మళ్లీ ప్రయత్నించండి'], kn: ['ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ'] },
  // RAL_READ_ALONG_ARROW
  masteryReadAlong: { en: ['READ ALONG'], hi: ['साथ-साथ पढ़ो'], te: ['కలిసి చదవండి'], kn: ['ಜೊತೆಗೆ ಓದಿ'] },
  // RAL_NOW_I_READ
  masteryNowIRead: { en: ["NOW I'LL READ"], hi: ['अब मैं पढ़ूँगा'], te: ['ఇప్పుడు నేను చదువుతాను'], kn: ['ಈಗ ನಾನು ಓದುತ್ತೇನೆ'] },
  // RAL_FEEDBACK_EXCELLENT
  masteryExcellent: { en: ['Excellent reading!'], hi: ['बहुत बढ़िया पढ़ा!'], te: ['అద్భుతంగా చదివారు!'], kn: ['ಅದ್ಭುತವಾಗಿ ಓದಿದಿರಿ!'] },
  // RAL_FEEDBACK_TIMEUP / RAL_SC_TIMEUP_HEART
  masteryTimeUp: { en: ["Time's up! Try a little faster.", "Time's up! You lost a heart."], hi: ['समय खत्म! थोड़ा तेज़ पढ़ने की कोशिश करो।', 'समय खत्म! एक दिल कम हो गया।'], te: ['సమయం అయిపోయింది! కొంచెం వేగంగా చదవడానికి ప్రయత్నించండి.', 'సమయం అయిపోయింది! ఒక హృదయం పోయింది.'], kn: ['ಸಮಯ ಮುಗಿಯಿತು! ಸ್ವಲ್ಪ ವೇಗವಾಗಿ ಓದಲು ಪ್ರಯತ್ನಿಸಿ.', 'ಸಮಯ ಮುಗಿಯಿತು! ಒಂದು ಹೃದಯ ಕಳೆದುಹೋಯಿತು.'] },
  // RAL_FEEDBACK_NOHEAR
  masteryNoHear: { en: ["We couldn't hear that. Let's try again."], hi: ['हमें सुनाई नहीं दिया। फिर से कोशिश करते हैं।'], te: ['మాకు వినిపించలేదు. మళ్లీ ప్రయత్నిద్దాం.'], kn: ['ನಮಗೆ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸೋಣ.'] },
  // RAL_SUMMARY_READ_WELL
  masteryPiecesReadWell: { en: ['pieces read well'], hi: ['अंश अच्छे से पढ़े'], te: ['భాగాలు బాగా చదివారు'], kn: ['ತುಣುಕುಗಳನ್ನು ಚೆನ್ನಾಗಿ ಓದಿದ್ದು'] },
  // SPR_START
  selfPacedStart: { en: ['START'], hi: ['शुरू करो'], te: ['ప్రారంభించండి'], kn: ['ಪ್ರಾರಂಭಿಸಿ'] },
  // SPR_FINISH
  selfPacedFinish: { en: ['FINISH'], hi: ['पूरा करो'], te: ['ముగించండి'], kn: ['ಮುಗಿಸಿ'] },
  // SPR_HINT_WORD / SPR_HINT_GROUP
  selfPacedHint: { en: ['Tap to see each word · read it, then tap again', 'Tap to see each group of words · read it, then tap again'], hi: ['हर शब्द देखने के लिए टैप करो · उसे पढ़ो, फिर दोबारा टैप करो', 'शब्दों का हर समूह देखने के लिए टैप करो · उसे पढ़ो, फिर दोबारा टैप करो'], te: ['ప్రతి పదాన్ని చూడటానికి ట్యాప్ చేయండి · దాన్ని చదివి, మళ్లీ ట్యాప్ చేయండి', 'ప్రతి పదాల సమూహాన్ని చూడటానికి ట్యాప్ చేయండి · దాన్ని చదివి, మళ్లీ ట్యాప్ చేయండి'], kn: ['ಪ್ರತಿ ಪದವನ್ನು ನೋಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ · ಅದನ್ನು ಓದಿ, ನಂತರ ಮತ್ತೆ ಟ್ಯಾಪ್ ಮಾಡಿ', 'ಪ್ರತಿ ಪದ ಗುಂಪನ್ನು ನೋಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ · ಅದನ್ನು ಓದಿ, ನಂತರ ಮತ್ತೆ ಟ್ಯಾಪ್ ಮಾಡಿ'] },
  // SPR_QUESTION
  selfPacedQuestion: { en: ['Did you see this word in the text?'], hi: ['क्या तुमने यह शब्द पाठ में देखा?'], te: ['ఈ పదాన్ని పాఠంలో చూశారా?'], kn: ['ಈ ಪದವನ್ನು ಪಠ್ಯದಲ್ಲಿ ನೋಡಿದ್ದೀರಾ?'] },
  // SPR_YES
  selfPacedYes: { en: ['YES'], hi: ['हाँ'], te: ['అవును'], kn: ['ಹೌದು'] },
  // SPR_NO
  selfPacedNo: { en: ['NO'], hi: ['नहीं'], te: ['కాదు'], kn: ['ಇಲ್ಲ'] },
  // SPR_CORRECT
  selfPacedCorrect: { en: ['Correct'], hi: ['सही'], te: ['సరైనది'], kn: ['ಸರಿ'] },
  // SPR_SUMMARY_ANSWERED_RIGHT
  selfPacedAnsweredRight: { en: ['questions answered right'], hi: ['सवालों के सही जवाब'], te: ['ప్రశ్నలకు సరైన సమాధానాలు'], kn: ['ಪ್ರಶ್ನೆಗಳಿಗೆ ಸರಿಯಾದ ಉತ್ತರ'] },
  // RAL_SC_HEARTS_LEFT
  showcaseHeartsLeft: { en: ['{count} hearts left'], hi: ['{count} दिल बाकी'], te: ['{count} హృదయాలు మిగిలాయి'], kn: ['{count} ಹೃದಯಗಳು ಉಳಿದಿವೆ'] },
  // RAL_SC_MISS_HEART / RAL_SC_TIMEUP_HEART / RAL_SC_LAST_HEART
  showcaseLostHeart: { en: ['Not quite. You lost a heart.', "Time's up! You lost a heart.", 'That was your last heart.'], hi: ['थोड़ा और। एक दिल कम हो गया।', 'समय खत्म! एक दिल कम हो गया।', 'यह आपका आखिरी दिल था।'], te: ['ఇంకొంచెం. ఒక హృదయం పోయింది.', 'సమయం అయిపోయింది! ఒక హృదయం పోయింది.', 'అది మీ చివరి హృదయం.'], kn: ['ಇನ್ನೂ ಸ್ವಲ್ಪ. ಒಂದು ಹೃದಯ ಕಳೆದುಹೋಯಿತು.', 'ಸಮಯ ಮುಗಿಯಿತು! ಒಂದು ಹೃದಯ ಕಳೆದುಹೋಯಿತು.', 'ಅದು ನಿಮ್ಮ ಕೊನೆಯ ಹೃದಯವಾಗಿತ್ತು.'] },
  // RAL_SC_PASSED
  showcasePassed: { en: ['{step} passed!'], hi: ['{step} पास!'], te: ['{step} పాస్!'], kn: ['{step} ಪಾಸ್!'] },
  // RAL_SC_NOT_YET
  showcaseNotYet: { en: ['{step} not quite yet'], hi: ['{step} अभी नहीं'], te: ['{step} ఇంకా కాలేదు'], kn: ['{step} ಇನ್ನೂ ಆಗಿಲ್ಲ'] },
  // MILESTONE_COMPLETE_TITLE
  milestoneComplete: { en: ['Milestone {number} Complete!'], hi: ['माइलस्टोन {number} पूरा हुआ!'], te: ['మైలురాయి {number} పూర్తయింది!'], kn: ['ಮೈಲಿಗಲ್ಲು {number} ಪೂರ್ಣಗೊಂಡಿದೆ!'] },
  // MILESTONE_COMPLETE_RETURN
  returnToRoadmap: { en: ['RETURN TO ROADMAP'], hi: ['रोडमैप पर वापस जाओ'], te: ['రోడ్‌మ్యాప్‌కు తిరిగి వెళ్ళండి'], kn: ['ರೋಡ್‌ಮ್ಯಾಪ್‌ಗೆ ಹಿಂತಿರುಗಿ'] },
  // RESULT_LOAD_FAILED (the app's message when a result cannot be fetched)
  resultLoadFailed: { en: ["We couldn't get your result. Please try again."], hi: ['आपका परिणाम नहीं मिल सका। कृपया फिर से प्रयास करें।'], te: ['మీ ఫలితం పొందలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.'], kn: ['ನಿಮ್ಮ ಫಲಿತಾಂಶ ಪಡೆಯಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುನಃ ಪ್ರಯತ್ನಿಸಿ.'] },
  // ALL_MILESTONES_COMPLETE_TITLE (course-complete screen after M9, when the app renders it)
  allMilestonesComplete: {
    en: ['You finished every milestone!'], hi: ['तुमने सभी माइलस्टोन पूरे कर लिए!'], te: ['మీరు అన్ని మైలురాళ్ళు పూర్తి చేశారు!'], kn: ['ನೀವು ಎಲ್ಲಾ ಮೈಲಿಗಲ್ಲುಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ!'],
  },
  // HURRAY
  hurray: { en: ['Hurray!!!'], hi: ['शाबाश!!!'], te: ['అభినందనలు!!!'], kn: ['ಅಭಿನಂದನೆಗಳು!!!'] },
} satisfies Record<string, Partial<Record<LangCode, string[]>> & { englishOnly?: boolean }>;
