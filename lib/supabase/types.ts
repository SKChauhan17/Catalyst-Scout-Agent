export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          raw_text: string;
          parsed_requirements: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          raw_text: string;
          parsed_requirements?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          raw_text?: string;
          parsed_requirements?: Json | null;
          created_at?: string | null;
        };
      };
      evaluations: {
        Row: {
          id: string;
          candidate_id: string | null;
          job_id: string | null;
          match_score: number | null;
          interest_score: number | null;
          final_score: number | null;
          chat_transcript: Json | null;
          candidate_snapshot: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          candidate_id?: string | null;
          job_id?: string | null;
          match_score?: number | null;
          interest_score?: number | null;
          final_score?: number | null;
          chat_transcript?: Json | null;
          candidate_snapshot?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          candidate_id?: string | null;
          job_id?: string | null;
          match_score?: number | null;
          interest_score?: number | null;
          final_score?: number | null;
          chat_transcript?: Json | null;
          candidate_snapshot?: Json | null;
          created_at?: string | null;
        };
      };
      logs: {
        Row: {
          id: string;
          session_id: string;
          message: string;
          level: string | null;
          node_name: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          message: string;
          level?: string | null;
          node_name?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          message?: string;
          level?: string | null;
          node_name?: string | null;
          created_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
