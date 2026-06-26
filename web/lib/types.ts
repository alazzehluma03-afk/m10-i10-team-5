// TypeScript interfaces — must mirror api/models.py exactly.
// snake_case field names preserved (chunk_id, not chunkId).

// --- Request types ---

export interface ExtractRequest {
  text: string;
}

export interface KGQueryRequest {
  question: string;
}

export interface RAGRequest {
  question: string;
  k?: number;
}

// --- Response types ---

export interface Entity {
  text: string;
  label: string;
  start: number;
  end: number;
}

export interface ExtractResponse {
  entities: Entity[];
}

export interface KGResponse {
  cypher: string;
  rows: Record<string, unknown>[];
  count: number;
}

export interface UnsupportedQueryDetail {
  reason: "unsupported_question";
  supported_patterns: string[];
}

export interface Citation {
  chunk_id: number;
  score: number;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
}
