/**
 * Supabase 数据库类型（手写，与 supabase/migrations/0001_init.sql 保持一致）。
 *
 * 后期可以用 `supabase gen types typescript --project-id <id>` 自动生成，
 * 现在手写够用且不需要 Supabase CLI。
 */

export type GameType = "gomoku" | "xiangqi";
export type MatchStatus = "waiting" | "playing" | "finished" | "aborted";
export type MatchWinner = "a" | "b" | "draw";
export type SeriesFormat = "bo1" | "bo3" | "bo5";

export type MatchRow = {
  id: string;
  game_type: GameType;
  status: MatchStatus;
  player_a: string | null;
  player_b: string | null;
  player_a_nickname: string;
  player_b_nickname: string | null;
  start_hhmm: number | null;
  winner: MatchWinner | null;
  result_reason: string | null;
  share_token: string;
  undo_used_a: boolean;
  undo_used_b: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  rematch_match_id: string | null;
  series_format: SeriesFormat;
  series_parent_id: string | null;
  series_round: number;
};

export type MatchInsert = {
  game_type: GameType;
  player_a: string;
  player_a_nickname: string;
  status?: MatchStatus;
  player_b?: string;
  player_b_nickname?: string;
  series_format?: SeriesFormat;
  series_parent_id?: string;
  series_round?: number;
};

export type MatchUpdate = Partial<Omit<MatchRow, "id" | "created_at">>;

export type MoveRow = {
  match_id: string;
  ply: number;
  notation: string;
  data: { x: number; y: number; stone: "black" | "white" };
  created_at: string;
};

export type MoveInsert = Omit<MoveRow, "created_at">;

export type ProfileRow = {
  id: string;
  nickname: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  nickname: string;
  is_anonymous?: boolean;
};

export type ProfileUpdate = Partial<Omit<ProfileRow, "id" | "created_at">>;

/** @supabase/ssr 期望的 Database 形状（含 Relationships / Views / Enums / CompositeTypes 占位） */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: MatchInsert;
        Update: MatchUpdate;
        Relationships: [];
      };
      moves: {
        Row: MoveRow;
        Insert: MoveInsert;
        Update: Partial<MoveRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_match: {
        Args: { p_match_id: string; p_nickname: string };
        Returns: MatchRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
