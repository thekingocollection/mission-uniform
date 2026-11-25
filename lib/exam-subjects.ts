export const EXAM_SUBJECTS = [
  { name: "Odia Grammar", aliases: ["odiagrammar", "odiyagrammar", "odia"], slug: "odia-grammar", odia: "ଓଡ଼ିଆ ବ୍ୟାକରଣ", description: "Odia language and grammar." },
  { name: "English Grammar", aliases: ["englishgrammar", "english"], slug: "english-grammar", odia: "ଇଂରାଜୀ ବ୍ୟାକରଣ", description: "English grammar and language practice." },
  { name: "General Knowledge", aliases: ["generalknowledge", "gk", "generalknowledgeandcurrentaffairs"], slug: "general-knowledge", odia: "ସାଧାରଣ ଜ୍ଞାନ", description: "India, Odisha, world, science and current affairs." },
  { name: "Quantitative Aptitude", aliases: ["quantitativeaptitude", "quantitative", "math", "mathematics", "arithmetic"], slug: "quantitative-aptitude", odia: "ଗଣିତ", description: "Arithmetic and quantitative problem solving." },
  { name: "Reasoning", aliases: ["reasoning", "logicalreasoning", "mentalability"], slug: "reasoning", odia: "ଯୁକ୍ତିତର୍କ", description: "Logical, verbal and non-verbal reasoning." },
  { name: "Basic Computer Literacy", aliases: ["basiccomputerliteracy", "computerliteracy", "computer", "basiccomputer", "computerawareness", "computerknowledge", "basicknowledgeofcomputer", "computerfundamentals", "computerapplications", "informationtechnology", "it"], slug: "basic-computer-literacy", odia: "ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ", description: "Basic computer knowledge and digital literacy." },
  { name: "Previous Year Questions", aliases: ["previousyearquestions", "previousyearquestion", "previouspapers", "pyq", "previousyearpapers"], slug: "previous-year-questions", odia: "ପୂର୍ବବର୍ଷର ପ୍ରଶ୍ନ", description: "Previous year exam papers and questions." }
] as const;

export function normalizeSubjectName(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getExamSubject(value: unknown) {
  const key = normalizeSubjectName(value);
  return EXAM_SUBJECTS.find(subject => (subject.aliases as readonly string[]).includes(key)) || null;
}

export function isExamSubject(value: unknown): boolean {
  return Boolean(getExamSubject(value));
}

export function examSubjectLabel(value: unknown): string | null {
  return getExamSubject(value)?.name || null;
}

export function filterExamSubjects<T extends { name_en?: string | null; name_hi?: string | null }>(rows: T[]): T[] {
  return EXAM_SUBJECTS.flatMap(subject => {
    const row = rows.find(item => getExamSubject(item.name_en)?.name === subject.name || getExamSubject(item.name_hi)?.name === subject.name);
    return row ? [row] : [];
  });
}
