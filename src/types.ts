export interface Profile {
  regNo: string;
  name: string;
  batch: string;
  center: string;
  latestRank: string;
  latestRankDate?: string;
  stream?: string;
  class?: string;
}

export interface SubjectScore {
  subject: string;
  score: string | number;
}

export interface TestRecord {
  date: string;
  name: string;
  type: string;
  outOf: string | number;
  score: string | number;
  avgScore: string;
  sub1: string | number;
  sub2: string | number;
  sub3: string | number;
  sub4: string | number;
  unattempted: string | number;
  centerRank: string | number;
  testClass?: string;
  subjectScores?: SubjectScore[];
}

export interface Student {
  profile: Profile;
  tests: TestRecord[];
}

export interface Dropdowns {
  batches: string[];
  names: string[];
  sheets?: string[];
  sheetStats?: Record<string, number>;
  sheetUrls?: Record<string, string>;
  lastLoaded?: string | null;
  isLoading?: boolean;
}
