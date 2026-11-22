import Link from "next/link";

const odiaTopics = [
  "ଶବ୍ଦ", "ଲିଙ୍ଗ, ବଚନ, ପୁରୁଷ", "ବିଶେଷ୍ୟ", "ବିଶେଷଣ", "ସର୍ବନାମ", "ପ୍ରତ୍ୟୟ",
  "କ୍ରିୟାବିଶେଷଣ ଶବ୍ଦ", "ସମୋଚ୍ଚାରିତ ଭିନ୍ନାର୍ଥକ ଶବ୍ଦ", "ଅନେକାର୍ଥବୋଧକ ଶବ୍ଦ",
  "କାଳ ଓ ବିଭକ୍ତି", "ଅବ୍ୟୟ", "ଉପସର୍ଗ", "କ୍ରିୟା", "ଶୁଦ୍ଧ ବାକ୍ୟ ଓ ଅଶୁଦ୍ଧ ବାକ୍ୟ",
  "ସନ୍ଧି", "ସମାସ", "ତଦ୍ଭବ", "ତତ୍ସମ", "ପଦ ପରିବର୍ତ୍ତନ", "ବାକ୍ୟ",
  "ପ୍ରତ୍ୟୟଯୋଗ ଓ ପ୍ରତ୍ୟୟାନ୍ତ", "କ୍ରିୟାର ବାଚ୍ୟ", "ରୂଢ଼ି ପ୍ରୟୋଗ",
  "ଲୋକବାଣୀ", "ସାଧାରଣ ଅଶୁଦ୍ଧି", "ଶବ୍ଦ ପରିବର୍ତ୍ତନର ଅର୍ଥବୋଧ"
];
const englishTopics = [
  "Vocabulary", "Synonyms and Antonyms", "One-word Substitution", "Idioms and Phrases",
  "Grammar and Usage", "Articles and Determiners", "Prepositions", "Tenses",
  "Subject-Verb Agreement", "Active and Passive Voice", "Direct and Indirect Speech",
  "Sentence Correction", "Error Detection", "Rearrangement of Sentences", "Comprehension"
];
const mathsTopics = [
  "Number System", "Simplification", "Decimals and Fractions", "HCF and LCM",
  "Percentage", "Ratio and Proportion", "Average", "Profit and Loss", "Simple Interest",
  "Mensuration", "Time and Work", "Time, Speed and Distance", "Data Interpretation"
];
const reasoningTopics = [
  "Analogy", "Classification", "Series", "Coding-Decoding", "Blood Relations",
  "Direction Sense", "Order and Ranking", "Pattern Recognition", "Figure Analogy",
  "Figure Classification", "Mirror and Water Images"
];
const computerTopics = [
  "Basics of Computers", "Computer Hardware and Software", "Operating Systems",
  "Input and Output Devices", "MS Office Basics", "Internet and E-mail",
  "Digital Payment Systems", "Cyber Safety", "Social Media Awareness",
  "Basic Government Digital Services"
];
function TopicList({ items, language = "en" }: { items: string[]; language?: "en" | "or" }) {
  return <ol className="mu-syllabus-topic-list" lang={language === "or" ? "or" : "en"}>
    {items.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}
  </ol>;
}
function SyllabusCard({ code, title, description, children, links }: {
  code: string; title: string; description: string; children: React.ReactNode;
  links?: { href: string; label: string }[];
}) {
  return <section className="mu-syllabus-card">
    <div className="mu-syllabus-card-head">
      <span className="mu-syllabus-code">{code}</span>
      <div><h2>{title}</h2><p>{description}</p></div>
    </div>
    {children}
    {links && <div className="mu-syllabus-card-links">{links.map(link => <Link key={link.href} href={link.href}>{link.label} →</Link>)}</div>}
  </section>;
}
export default function SyllabusPage() {
  return <main className="mu-study-page">
    <section className="mu-study-hero">
      <div>
        <span className="mu-study-kicker">MISSION UNIFORM OP · ODISHA POLICE EXAM</span>
        <h1>Complete Exam Syllabus.<br/><em>Prepare Topic by Topic.</em></h1>
        <p>Follow the subject-wise syllabus, practise chapter-based questions and review your mock-test performance.</p>
        <div className="mu-study-actions"><Link href="/subject-mock-test">Start Subject Practice ↗</Link><Link href="/tests">Special Mock Tests →</Link></div>
      </div>
      <div className="mu-syllabus-hero-mark" aria-label="Odisha Police exam syllabus">
        <span>ODISHA POLICE</span><strong>SYLLABUS</strong><b>EXAM PREPARATION</b><small>STUDY · PRACTISE · REVIEW</small>
      </div>
    </section>
    <section className="mu-syllabus-intro">
      <div><span>EXAM PREPARATION ROADMAP</span><h2>Subject-wise Syllabus</h2><p>All subjects and topics are listed in English. Only the Odia Language section is written entirely in Odia.</p></div>
      <div className="mu-syllabus-summary"><b>06</b><span>SUBJECT BANKS</span></div>
    </section>
    <div className="mu-syllabus-groups">
      <SyllabusCard code="A" title="ଓଡ଼ିଆ ଭାଷା" description="ଓଡ଼ିଆ ବ୍ୟାକରଣ">
        <TopicList items={odiaTopics} language="or" />
      </SyllabusCard>
      <SyllabusCard code="B" title="English Grammar" description="Grammar, vocabulary, sentence structure and comprehension." links={[{href:"/subjects/english-grammar",label:"English Practice"}]}>
        <TopicList items={englishTopics} />
      </SyllabusCard>
      <SyllabusCard code="C" title="General Knowledge" description="Current affairs, history, geography, polity, economy and general science.">
        <div className="mu-syllabus-category-grid">
          <article><h3>Current Affairs</h3><p>State, national and international events; sports; awards; important days; books and authors; science and new technology.</p></article>
          <article><h3>History</h3><p>Ancient India; medieval India; modern India; national movement; history and cultural heritage of Odisha.</p></article>
          <article><h3>Geography</h3><p>Physical geography of India; natural resources; agriculture; physical and economic geography of Odisha.</p></article>
          <article><h3>Polity</h3><p>Indian Constitution; Fundamental Rights and Duties; Directive Principles of State Policy; Union and State Governments; local self-government.</p></article>
          <article><h3>Economy</h3><p>Basic concepts of the Indian economy and economic development.</p></article>
          <article><h3>General Science</h3><p>Everyday science; Class 10 level Physics, Chemistry, Biology and Environmental Science.</p></article>
        </div>
        <div className="mu-syllabus-card-links"><Link href="/subjects/general-knowledge">General Knowledge Practice →</Link><Link href="/subjects/odisha-gk">Odisha GK Practice →</Link></div>
      </SyllabusCard>
      <SyllabusCard code="D" title="Quantitative Aptitude" description="Numerical ability and mathematical problem solving." links={[{href:"/subjects/quantitative-aptitude",label:"Practise Quantitative Aptitude"}]}>
        <TopicList items={mathsTopics} />
      </SyllabusCard>
      <SyllabusCard code="E" title="Reasoning" description="Logical, analytical and non-verbal reasoning." links={[{href:"/subjects/reasoning",label:"Practise Reasoning"}]}>
        <TopicList items={reasoningTopics} />
      </SyllabusCard>
      <SyllabusCard code="F" title="Basic Computer Literacy" description="Computer fundamentals, office tools, internet and digital awareness." links={[{href:"/subjects/basic-computer-literacy",label:"Computer Practice"}]}>
        <TopicList items={computerTopics} />
      </SyllabusCard>
    </div>
    <section className="mu-syllabus-footer-cta">
      <span>YOUR NEXT STEP</span><h2>Study a Topic. Attempt a Test. Track Your Progress.</h2>
      <Link href="/subject-mock-test">Start Mock Test Practice →</Link>
    </section>
  </main>;
}
