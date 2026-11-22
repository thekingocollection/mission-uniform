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
  "Percentage", "Ratio and Proportion", "Average", "Profit and Loss",
  "Simple Interest", "Mensuration", "Time and Work", "Time, Speed and Distance",
  "Data Interpretation"
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

function SyllabusCard({ code, title, odia, description, children, links }: {
  code: string; title: string; odia: string; description: string;
  children: React.ReactNode; links?: { href: string; label: string }[];
}) {
  return <section className="mu-syllabus-card">
    <div className="mu-syllabus-card-head">
      <span className="mu-syllabus-code">{code}</span>
      <div><h2>{title}</h2><h3 lang="or">{odia}</h3><p>{description}</p></div>
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
        <h1>Know what to study.<br/><em>Prepare topic by topic.</em></h1>
        <p>Use this subject-wise syllabus as your preparation checklist. Study each topic, practise questions and review your mock-test performance.</p>
        <p lang="or">ଏହି ବିଷୟଭିତ୍ତିକ ପାଠ୍ୟକ୍ରମ ଅନୁସାରେ ପ୍ରସ୍ତୁତି କରନ୍ତୁ। ପ୍ରତ୍ୟେକ ଅଧ୍ୟାୟ ପଢ଼ନ୍ତୁ, ପ୍ରଶ୍ନ ଅଭ୍ୟାସ କରନ୍ତୁ ଓ ମକ୍ ଟେଷ୍ଟ ଫଳାଫଳ ଯାଞ୍ଚ କରନ୍ତୁ।</p>
        <div className="mu-study-actions"><Link href="/subject-mock-test">Start Subject Practice ↗</Link><Link href="/tests">Special Mock Tests →</Link></div>
      </div>
      <div className="mu-syllabus-hero-mark" aria-label="Odisha Police exam syllabus">
        <span>ODISHA POLICE</span><strong>SYLLABUS</strong><b>ଓଡ଼ିଶା ପୋଲିସ୍</b><small>STUDY · PRACTISE · REVIEW</small>
      </div>
    </section>

    <section className="mu-syllabus-intro">
      <div><span>EXAM PREPARATION ROADMAP</span><h2>Subject-wise syllabus</h2><p>English and Odia headings are provided to make the topics easier to follow.</p><p lang="or">ସହଜରେ ବୁଝିବା ପାଇଁ ବିଷୟଗୁଡ଼ିକୁ ଇଂରାଜୀ ଓ ଓଡ଼ିଆରେ ଦିଆଯାଇଛି।</p></div>
      <div className="mu-syllabus-summary"><b>05</b><span>SUBJECT GROUPS</span></div>
    </section>

    <div className="mu-syllabus-groups">
      <SyllabusCard code="A" title="Odia Language" odia="ଓଡ଼ିଆ ଭାଷା" description="Odia grammar, vocabulary and sentence usage · ଓଡ଼ିଆ ବ୍ୟାକରଣ, ଶବ୍ଦ ଓ ବାକ୍ୟ ପ୍ରୟୋଗ" links={[{href:"/subjects/odia-grammar",label:"Odia practice"}]}>
        <TopicList items={odiaTopics} language="or" />
      </SyllabusCard>

      <SyllabusCard code="B" title="English Language" odia="ଇଂରାଜୀ ଭାଷା" description="Grammar, vocabulary, sentence structure and comprehension." links={[{href:"/subjects/english-grammar",label:"English practice"}]}>
        <TopicList items={englishTopics} />
      </SyllabusCard>

      <SyllabusCard code="C" title="General Knowledge" odia="ସାଧାରଣ ଜ୍ଞାନ" description="State, national and international awareness · ରାଜ୍ୟ, ଜାତୀୟ ଓ ଆନ୍ତର୍ଜାତୀୟ ସାଧାରଣ ଜ୍ଞାନ">
        <div className="mu-syllabus-category-grid">
          <article><h3>Current Affairs · ସାମ୍ପ୍ରତିକ ଘଟଣା</h3><p>State, national and international events, sports, awards, important days, books and authors, science and new technology.</p><p lang="or">ରାଜ୍ୟ, ଜାତୀୟ ଓ ଆନ୍ତର୍ଜାତୀୟ ଘଟଣା, କ୍ରୀଡ଼ା, ପୁରସ୍କାର, ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଦିବସ, ପୁସ୍ତକ ଓ ଲେଖକ, ବିଜ୍ଞାନ ଓ ନୂତନ ପ୍ରଯୁକ୍ତି।</p></article>
          <article><h3>History · ଇତିହାସ</h3><p>Ancient, medieval and modern India, national movement, Odisha history and cultural heritage.</p><p lang="or">ପ୍ରାଚୀନ, ମଧ୍ୟଯୁଗୀୟ ଓ ଆଧୁନିକ ଭାରତ, ଜାତୀୟ ଆନ୍ଦୋଳନ, ଓଡ଼ିଶାର ଇତିହାସ ଓ ସାଂସ୍କୃତିକ ଐତିହ୍ୟ।</p></article>
          <article><h3>Geography · ଭୂଗୋଳ</h3><p>Physical geography of India, natural resources, agriculture, and physical and economic geography of Odisha.</p><p lang="or">ଭାରତର ଭୌତିକ ଭୂଗୋଳ, ପ୍ରାକୃତିକ ସମ୍ପଦ, କୃଷି, ଓଡ଼ିଶାର ଭୌତିକ ଓ ଅର୍ଥନୈତିକ ଭୂଗୋଳ।</p></article>
          <article><h3>Polity · ରାଜନୀତି ବିଜ୍ଞାନ</h3><p>Indian Constitution, Fundamental Rights and Duties, Directive Principles, Union and State Government, local self-government.</p><p lang="or">ଭାରତୀୟ ସମ୍ବିଧାନ, ମୌଳିକ ଅଧିକାର ଓ କର୍ତ୍ତବ୍ୟ, ରାଷ୍ଟ୍ରନୀତିର ନିର୍ଦ୍ଦେଶକ ତତ୍ତ୍ୱ, କେନ୍ଦ୍ର ଓ ରାଜ୍ୟ ସରକାର, ସ୍ଥାନୀୟ ସ୍ୱଶାସନ।</p></article>
          <article><h3>Economy · ଅର୍ଥନୀତି</h3><p>Basic concepts of the Indian economy and economic development.</p><p lang="or">ଭାରତୀୟ ଅର୍ଥନୀତିର ମୌଳିକ ଧାରଣା ଓ ଅର୍ଥନୈତିକ ବିକାଶ।</p></article>
          <article><h3>General Science · ସାଧାରଣ ବିଜ୍ଞାନ</h3><p>Everyday science, Class 10 level Physics, Chemistry, Biology and Environmental Science.</p><p lang="or">ଦୈନନ୍ଦିନ ବିଜ୍ଞାନ, ଦଶମ ଶ୍ରେଣୀ ସ୍ତରର ପଦାର୍ଥ ବିଜ୍ଞାନ, ରସାୟନ ବିଜ୍ଞାନ, ଜୀବ ବିଜ୍ଞାନ ଓ ପରିବେଶ ବିଜ୍ଞାନ।</p></article>
        </div>
        <div className="mu-syllabus-card-links"><Link href="/subjects/general-knowledge">General Knowledge practice →</Link><Link href="/subjects/odisha-gk">Odisha GK practice →</Link></div>
      </SyllabusCard>

      <SyllabusCard code="D" title="Quantitative Aptitude and Reasoning" odia="ଗଣିତ ଓ ଯୁକ୍ତିତର୍କ" description="Numerical ability, problem solving and logical reasoning.">
        <div className="mu-syllabus-two-columns">
          <div><h3>Mathematics · ଗଣିତ</h3><TopicList items={mathsTopics} /><Link href="/subjects/quantitative-aptitude">Practise Mathematics →</Link></div>
          <div><h3>Reasoning · ଯୁକ୍ତିତର୍କ</h3><TopicList items={reasoningTopics} /><Link href="/subjects/reasoning">Practise Reasoning →</Link></div>
        </div>
      </SyllabusCard>

      <SyllabusCard code="E" title="Basic Computer Literacy" odia="ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ" description="Computer fundamentals, office tools, internet and digital awareness." links={[{href:"/subjects/basic-computer-literacy",label:"Computer practice"}]}>
        <TopicList items={computerTopics} />
      </SyllabusCard>
    </div>

    <section className="mu-syllabus-footer-cta">
      <span>YOUR NEXT STEP · ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ</span>
      <h2>Study a topic. Attempt a test. Track your progress.</h2>
      <p lang="or">ଏକ ଅଧ୍ୟାୟ ପଢ଼ନ୍ତୁ। ଟେଷ୍ଟ ଦିଅନ୍ତୁ। ନିଜର ଉନ୍ନତି ଯାଞ୍ଚ କରନ୍ତୁ।</p>
      <Link href="/subject-mock-test">Start Mock Test Practice →</Link>
    </section>
  </main>;
}
