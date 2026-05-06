type IssueCategory = "correctness" | "maintainability" | "accessibility" | "performance" | "dx" | "code-quality";

type IssueImpact = "high" | "medium" | "low";

export interface LintMessage {
  ruleId: string | null;
  message: string;
  line: number | null;
  column: number | null;
  severity: number; // 1 = warning, 2 = error
  category?: IssueCategory;
  impact?: IssueImpact;
  fixable?: boolean;
  source?: "eslint" | "typescript" | "heuristic";
}

export interface IssueExplanation {
  title: string;
  why: string;
  fix: string;
  risk: IssueImpact;
  autofix: boolean;
}

export interface FileReport {
  filePath: string;
  errorCount: number;
  warningCount: number;
  messages: LintMessage[];
}

export interface ScanReport {
  generatedAt: string;
  summary: {
    errors: number;
    warnings: number;
    totalIssues: number;
    filesWithIssues: number;
    score: number;
    categories: Record<IssueCategory, number>;
  };
  files: FileReport[];
  scope?: "all" | "changed" | "staged" | "custom";
  metadata?: {
    projectName?: string;
    reportFile?: string;
    extensions?: string[];
  };
}

export interface ScanSnapshot {
  savedAt: string;
  report: ScanReport;
}

export interface HealthReport {
  generatedAt: string;
  score: number;
  summary: {
    errors: number;
    warnings: number;
    filesWithIssues: number;
    safeAutofixes: number;
    highImpactIssues: number;
    images: number;
    imageBytes: number;
  };
  categories: Record<IssueCategory, { count: number; score: number; label: string }>;
  priorities: Array<{
    label: string;
    detail: string;
    impact: IssueImpact;
  }>;
  hotspots: Array<{
    filePath: string;
    score: number;
    errors: number;
    warnings: number;
  }>;
}

export interface FixPreview {
  filePath: string;
  before: string;
  after: string;
  changedLines: number;
  diffPreview: string[];
  hunks: FixHunk[];
}

export interface FixHunk {
  id: string;
  label: string;
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
  beforeLines: string[];
  afterLines: string[];
  preview: string[];
}
