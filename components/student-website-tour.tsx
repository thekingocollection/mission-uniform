"use client";

import { useEffect, useState } from "react";

type Lang = "en" | "hi" | "or";

const copy = {
  en: {
    title: "Welcome to Mission Uniform OP",
    intro: "A quick guided tour will show you how to use your student portal.",
    steps: [
      ["Your Student Dashboard", "This is your home after login. Start your preparation here and use the menu to move around the website."],
      ["Your Preparation", "See how many tests you have attempted and keep track of your daily preparation."],
      ["Subject Mock Tests", "Choose a subject, select English or Odia, answer questions and submit your practice test."],
      ["Special Mock Tests", "Try complete exam-style mock papers and practise within the test timer."],
      ["Previous Year Papers", "Open previous papers to understand the exam pattern and practise real exam-style questions."],
      ["Syllabus", "Check the subjects and topics you need to cover for your Odisha Police preparation."],
      ["Test History & Performance", "Review your completed tests, scores and progress to find areas that need more practice."],
    ],
    next: "Next", back: "Back", skip: "Skip tour", finish: "Finish", step: "Step",
    replay: "How to Use", language: "Tutorial language",
    done: "Great job! You are ready to explore Mission Uniform OP.",
  },
  hi: {
    title: "Mission Uniform OP में आपका स्वागत है",
    intro: "यह छोटा टूर आपको Student Portal चलाना सिखाएगा।",
    steps: [
      ["आपका Student Dashboard", "Login के बाद यह आपका मुख्य पेज है। यहीं से तैयारी शुरू करें और वेबसाइट के दूसरे पेज खोलने के लिए Menu इस्तेमाल करें।"],
      ["आपकी तैयारी", "यहाँ देखें आपने कितने टेस्ट दिए हैं और अपनी तैयारी पर नज़र रखें।"],
      ["Subject Mock Tests", "Subject चुनें, English या Odia भाषा चुनें, प्रश्न हल करें और टेस्ट Submit करें।"],
      ["Special Mock Tests", "पूरा परीक्षा जैसा Mock Paper दें और Timer के अंदर अभ्यास करें।"],
      ["Previous Year Papers", "पिछले वर्षों के पेपर खोलकर परीक्षा का पैटर्न समझें और अभ्यास करें।"],
      ["Syllabus", "Odisha Police की तैयारी के लिए सभी Subjects और Topics देखें।"],
      ["Test History & Performance", "अपने पुराने टेस्ट, Marks और Progress देखें तथा कमजोर Topics पर दोबारा अभ्यास करें।"],
    ],
    next: "आगे", back: "पीछे", skip: "टूर छोड़ें", finish: "पूरा करें", step: "चरण",
    replay: "वेबसाइट चलाना सीखें", language: "ट्यूटोरियल की भाषा",
    done: "बहुत अच्छा! अब आप Mission Uniform OP इस्तेमाल कर सकते हैं।",
  },
  or: {
    title: "Mission Uniform OP କୁ ସ୍ୱାଗତ",
    intro: "ଏହି ଛୋଟ ଟୁର୍ ଆପଣଙ୍କୁ Student Portal ବ୍ୟବହାର କରିବା ଶିଖାଇବ।",
    steps: [
      ["ଆପଣଙ୍କ Student Dashboard", "Login ପରେ ଏହା ଆପଣଙ୍କ ମୁଖ୍ୟ ପେଜ୍। ଏଠାରୁ ପ୍ରସ୍ତୁତି ଆରମ୍ଭ କରନ୍ତୁ ଏବଂ Menu ଦ୍ୱାରା ଅନ୍ୟ ପେଜ୍ ଖୋଲନ୍ତୁ।"],
      ["ଆପଣଙ୍କ ପ୍ରସ୍ତୁତି", "ଆପଣ କେତୋଟି ଟେଷ୍ଟ ଦେଇଛନ୍ତି ଏଠାରେ ଦେଖନ୍ତୁ।"],
      ["Subject Mock Tests", "ବିଷୟ ବାଛନ୍ତୁ, English କିମ୍ବା Odia ଭାଷା ବାଛନ୍ତୁ, ପ୍ରଶ୍ନର ଉତ୍ତର ଦେଇ Submit କରନ୍ତୁ।"],
      ["Special Mock Tests", "ସମ୍ପୂର୍ଣ୍ଣ ପରୀକ୍ଷା ଭଳି Mock Test ଦିଅନ୍ତୁ ଏବଂ Timer ମଧ୍ୟରେ ଅଭ୍ୟାସ କରନ୍ତୁ।"],
      ["Previous Year Papers", "ପୂର୍ବ ବର୍ଷର ପ୍ରଶ୍ନପତ୍ର ଦେଖି ପରୀକ୍ଷାର ଢାଞ୍ଚା ବୁଝନ୍ତୁ।"],
      ["Syllabus", "Odisha Police ପ୍ରସ୍ତୁତି ପାଇଁ ସମସ୍ତ ବିଷୟ ଏବଂ Topics ଦେଖନ୍ତୁ।"],
      ["Test History & Performance", "ପୁରୁଣା Test, Marks ଏବଂ Progress ଦେଖି ଅଧିକ ଅଭ୍ୟାସ ଆବଶ୍ୟକ ଥିବା ବିଷୟ ଚିହ୍ନଟ କରନ୍ତୁ।"],
    ],
    next: "ପରବର୍ତ୍ତୀ", back: "ପଛକୁ", skip: "ଟୁର୍ ଛାଡନ୍ତୁ", finish: "ସମାପ୍ତ", step: "ପଦକ୍ଷେପ",
    replay: "ୱେବସାଇଟ୍ ବ୍ୟବହାର ଶିଖନ୍ତୁ", language: "ଟୁଟୋରିଆଲ୍ ଭାଷା",
    done: "ବହୁତ ଭଲ! ଏବେ ଆପଣ Mission Uniform OP ବ୍ୟବହାର କରିପାରିବେ।",
  },
} as const;

const tourSteps = [
  ["[data-tour='welcome']", 0],
  ["[data-tour='overview']", 1],
  ["[data-tour='subject']", 2],
  ["[data-tour='mock']", 3],
  ["[data-tour='papers']", 4],
  ["[data-tour='syllabus']", 5],
  ["[data-tour='history']", 6],
] as const;

export default function StudentWebsiteTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<Lang>("en");
  const [completed, setCompleted] = useState(false);
  const t = copy[lang];

  useEffect(() => {
    try {
      if (window.localStorage.getItem("mu-student-tour-complete") !== "1") {
        const timer = window.setTimeout(() => setOpen(true), 700);
        return () => window.clearTimeout(timer);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const selector = tourSteps[index]?.[0];
    const target = selector ? document.querySelector(selector) : null;
    document.querySelectorAll(".mu-tour-highlight").forEach(el => el.classList.remove("mu-tour-highlight"));
    if (target) {
      target.classList.add("mu-tour-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return () => {
      document.querySelectorAll(".mu-tour-highlight").forEach(el => el.classList.remove("mu-tour-highlight"));
    };
  }, [open, index]);

  const close = (save: boolean) => {
    setOpen(false);
    document.querySelectorAll(".mu-tour-highlight").forEach(el => el.classList.remove("mu-tour-highlight"));
    if (save) {
      setCompleted(true);
      try { window.localStorage.setItem("mu-student-tour-complete", "1"); } catch { /* storage may be unavailable */ }
    }
  };

  const start = () => {
    setIndex(0);
    setCompleted(false);
    setOpen(true);
  };

  return (
    <>
      <button type="button" className="mu-tour-replay" onClick={start}>✦ {t.replay}</button>
      {open && (
        <div className="mu-tour-layer" role="dialog" aria-modal="true" aria-labelledby="mu-tour-title">
          <div className="mu-tour-backdrop" onClick={() => close(false)} />
          <section className="mu-tour-card">
            <div className="mu-tour-topline"><span>MISSION UNIFORM OP · STUDENT GUIDE</span><button type="button" onClick={() => close(false)} aria-label="Close tutorial">×</button></div>
            <div className="mu-tour-language">
              <label htmlFor="mu-tour-lang">{t.language}</label>
              <select id="mu-tour-lang" value={lang} onChange={e => setLang(e.target.value as Lang)}>
                <option value="en">English</option><option value="hi">हिंदी</option><option value="or">ଓଡ଼ିଆ</option>
              </select>
            </div>
            <div className="mu-tour-progress"><span style={{ width: ((index + 1) / tourSteps.length * 100) + "%" }} /></div>
            <p className="mu-tour-step">{t.step} {index + 1} / {tourSteps.length}</p>
            <h2 id="mu-tour-title">{index === 0 ? t.title : t.steps[tourSteps[index][1]][0]}</h2>
            <p className="mu-tour-description">{index === 0 ? t.intro + " " + t.steps[0][1] : t.steps[tourSteps[index][1]][1]}</p>
            <div className="mu-tour-actions">
              <button type="button" className="mu-tour-skip" onClick={() => close(true)}>{t.skip}</button>
              <div>
                {index > 0 && <button type="button" className="mu-tour-back" onClick={() => setIndex(v => Math.max(0, v - 1))}>{t.back}</button>}
                <button type="button" className="mu-tour-next" onClick={() => index === tourSteps.length - 1 ? close(true) : setIndex(v => v + 1)}>{index === tourSteps.length - 1 ? t.finish : t.next} →</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {completed && <span className="mu-tour-complete" role="status">{t.done}</span>}
    </>
  );
}
