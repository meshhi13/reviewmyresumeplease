export type Redaction = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type DragBox = Omit<Redaction, "id">;

export type Review = {
  id: number;
  resume_id: number;
  reviewer_id: number;
  reviewer_display_name: string;
  rating: number;
  feedback: string;
  created_at: string;
};

export type CommentReply = {
  id: number;
  comment_id: number;
  author_id: number;
  author_display_name: string;
  body: string;
  created_at: string;
};

export type Comment = {
  id: number;
  resume_id: number;
  author_id: number;
  author_display_name: string;
  body: string;
  page: number;
  /** Fraction of page width (0–1) */
  x: number;
  /** Fraction of page height (0–1) */
  y: number;
  width: number;
  height: number;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by_display_name: string | null;
  resolved_by_resume_id: number | null;
  resolved_by_resume_title: string | null;
  suggestion_start: number | null;
  suggestion_end: number | null;
  suggestion_original: string;
  suggestion_replacement: string;
  suggestion_status: "none" | "pending" | "applied" | "rejected";
  upvotes: number;
  downvotes: number;
  user_vote: number;
  replies: CommentReply[];
};

export type BrowseResume = {
  id: number;
  user_id: number;
  title: string | null;
  file_name: string;
  source_format: string;
  field_category: string;
  redactions: Redaction[];
  landed_companies: string[];
  anonymized: boolean;
  review_status: string;
  notes: string;
  created_at: string;
  owner_display_name: string | null;
  comment_count: number;
  open_comment_count: number;
  downvote_count: number;
  aggregate_score: number;
  score_count: number;
  user_score: number | null;
};

export type AppNotification = {
  id: number;
  kind: string;
  message: string;
  target_url: string;
  read: boolean;
  created_at: string;
  actor_display_name: string | null;
};

export type SavedResume = {
  id: number;
  user_id: number;
  title: string | null;
  file_name: string;
  source_format: string;
  field_category: string;
  latex_source: string;
  latex_source_hidden_for_privacy: boolean;
  redactions: Redaction[];
  landed_companies: string[];
  anonymized: boolean;
  review_status: string;
  notes: string;
  parent_resume_id: number | null;
  resolves_comment_id: number | null;
  fix_parent_resume_id: number | null;
  fix_parent_resume_title: string | null;
  fixes_comment_id: number | null;
  created_at: string;
  open_comment_count: number;
  aggregate_score: number;
  score_count: number;
  user_score: number | null;
};
