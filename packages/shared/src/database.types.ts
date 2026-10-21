// Fichier GÉNÉRÉ par Supabase (generate_typescript_types) : ne pas modifier à la main.
// À régénérer après chaque migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          battle_id: string
          created_at: string
          id: number
          kind: string
          profile_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: never
          kind: string
          profile_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: never
          kind?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_sides: {
        Row: {
          battle_id: string
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          image_url: string | null
          launch_signature: string | null
          launch_slot: number | null
          mint: string | null
          name: string
          side: Database["public"]["Enums"]["side_letter"]
          ticker: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          launch_signature?: string | null
          launch_slot?: number | null
          mint?: string | null
          name: string
          side: Database["public"]["Enums"]["side_letter"]
          ticker: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          launch_signature?: string | null
          launch_slot?: number | null
          mint?: string | null
          name?: string
          side?: Database["public"]["Enums"]["side_letter"]
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_sides_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_sides_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_watchers: {
        Row: {
          battle_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_watchers_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_watchers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          anti_cheat_rules: Json
          cancel_reason: string | null
          cluster: string
          created_at: string
          created_by: string
          duration_minutes: number
          ends_at: string | null
          finished_at: string | null
          formula_version: number
          id: string
          initial_buy_lamports: number
          is_featured: boolean
          launch_at: string | null
          lobby_minutes: number
          lobby_opens_at: string | null
          market_cap_window_seconds: number
          mode: Database["public"]["Enums"]["battle_mode"]
          score_mode: Database["public"]["Enums"]["score_mode"]
          score_weights: Json
          started_at: string | null
          status: Database["public"]["Enums"]["battle_status"]
          theme: string
          watchers_count: number
          winner_side: Database["public"]["Enums"]["side_letter"] | null
        }
        Insert: {
          anti_cheat_rules?: Json
          cancel_reason?: string | null
          cluster?: string
          created_at?: string
          created_by: string
          duration_minutes: number
          ends_at?: string | null
          finished_at?: string | null
          formula_version?: number
          id?: string
          initial_buy_lamports: number
          is_featured?: boolean
          launch_at?: string | null
          lobby_minutes: number
          lobby_opens_at?: string | null
          market_cap_window_seconds?: number
          mode: Database["public"]["Enums"]["battle_mode"]
          score_mode?: Database["public"]["Enums"]["score_mode"]
          score_weights?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          theme: string
          watchers_count?: number
          winner_side?: Database["public"]["Enums"]["side_letter"] | null
        }
        Update: {
          anti_cheat_rules?: Json
          cancel_reason?: string | null
          cluster?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          ends_at?: string | null
          finished_at?: string | null
          formula_version?: number
          id?: string
          initial_buy_lamports?: number
          is_featured?: boolean
          launch_at?: string | null
          lobby_minutes?: number
          lobby_opens_at?: string | null
          mode?: Database["public"]["Enums"]["battle_mode"]
          score_mode?: Database["public"]["Enums"]["score_mode"]
          score_weights?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          theme?: string
          watchers_count?: number
          winner_side?: Database["public"]["Enums"]["side_letter"] | null
        }
        Relationships: [
          {
            foreignKeyName: "battles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candles: {
        Row: {
          battle_id: string
          bucket: string
          close_price: number
          high_price: number
          low_price: number
          open_price: number
          side: Database["public"]["Enums"]["side_letter"]
          volume_lamports: number
        }
        Insert: {
          battle_id: string
          bucket: string
          close_price: number
          high_price: number
          low_price: number
          open_price: number
          side: Database["public"]["Enums"]["side_letter"]
          volume_lamports?: number
        }
        Update: {
          battle_id?: string
          bucket?: string
          close_price?: number
          high_price?: number
          low_price?: number
          open_price?: number
          side?: Database["public"]["Enums"]["side_letter"]
          volume_lamports?: number
        }
        Relationships: [
          {
            foreignKeyName: "candles_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string
          battle_id: string
          body: string
          created_at: string
          id: number
          is_hidden: boolean
        }
        Insert: {
          author_id: string
          battle_id: string
          body: string
          created_at?: string
          id?: never
          is_hidden?: boolean
        }
        Update: {
          author_id?: string
          battle_id?: string
          body?: string
          created_at?: string
          id?: never
          is_hidden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_txs: {
        Row: {
          created_at: string
          error: string | null
          nonce_account: string
          side_id: string
          signed_tx: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          nonce_account: string
          side_id: string
          signed_tx: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          nonce_account?: string
          side_id?: string
          signed_tx?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_txs_side_id_fkey"
            columns: ["side_id"]
            isOneToOne: true
            referencedRelation: "battle_sides"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          is_banned: boolean
          wallet: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          is_banned?: boolean
          wallet: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          is_banned?: boolean
          wallet?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: number
          keys: Json
          profile_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: never
          keys: Json
          profile_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: never
          keys?: Json
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: number
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          id?: never
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          id?: never
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      side_stats: {
        Row: {
          battle_id: string
          buys: number
          market_cap_lamports: number
          score: number
          sells: number
          side: Database["public"]["Enums"]["side_letter"]
          unique_holders: number
          updated_at: string
          volume_lamports: number
        }
        Insert: {
          battle_id: string
          buys?: number
          market_cap_lamports?: number
          score?: number
          sells?: number
          side: Database["public"]["Enums"]["side_letter"]
          unique_holders?: number
          updated_at?: string
          volume_lamports?: number
        }
        Update: {
          battle_id?: string
          buys?: number
          market_cap_lamports?: number
          score?: number
          sells?: number
          side?: Database["public"]["Enums"]["side_letter"]
          unique_holders?: number
          updated_at?: string
          volume_lamports?: number
        }
        Relationships: [
          {
            foreignKeyName: "side_stats_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots: {
        Row: {
          battle_id: string
          created_at: string
          formula_version: number
          payload: Json
          sha256: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          formula_version: number
          payload: Json
          sha256: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          formula_version?: number
          payload?: Json
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: true
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          battle_id: string
          block_time: string
          created_at: string
          id: number
          is_buy: boolean
          ix_index: number
          side: Database["public"]["Enums"]["side_letter"]
          signature: string
          slot: number
          sol_lamports: number
          token_amount: number
          virtual_sol_reserves: number
          virtual_token_reserves: number
          wallet: string
        }
        Insert: {
          battle_id: string
          block_time: string
          created_at?: string
          id?: never
          is_buy: boolean
          ix_index?: number
          side: Database["public"]["Enums"]["side_letter"]
          signature: string
          slot: number
          sol_lamports: number
          token_amount: number
          virtual_sol_reserves: number
          virtual_token_reserves: number
          wallet: string
        }
        Update: {
          battle_id?: string
          block_time?: string
          created_at?: string
          id?: never
          is_buy?: boolean
          ix_index?: number
          side?: Database["public"]["Enums"]["side_letter"]
          signature?: string
          slot?: number
          sol_lamports?: number
          token_amount?: number
          virtual_sol_reserves?: number
          virtual_token_reserves?: number
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_flags: {
        Row: {
          battle_id: string
          created_at: string
          details: Json
          reason: string
          wallet: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          details?: Json
          reason: string
          wallet: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          details?: Json
          reason?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_flags_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_duel: {
        Args: { p_battle: string; p_side: Json }
        Returns: undefined
      }
      cancel_battle: { Args: { p_battle: string }; Returns: undefined }
      consume_rate_limit: { Args: { p_action: string }; Returns: undefined }
      create_battle: {
        Args: {
          p_duration_minutes: number
          p_initial_buy_lamports: number
          p_lobby_minutes: number
          p_mode: Database["public"]["Enums"]["battle_mode"]
          p_score_mode: Database["public"]["Enums"]["score_mode"]
          p_score_weights: Json
          p_sides: Json
          p_theme: string
        }
        Returns: string
      }
      find_similar_sides: {
        Args: { p_min_similarity?: number; p_names: string[] }
        Returns: {
          battle_id: string
          name: string
          similarity: number
        }[]
      }
      set_battle_watch: {
        Args: { p_battle: string; p_watch: boolean }
        Returns: undefined
      }
    }
    Enums: {
      battle_mode: "creator" | "open_duel" | "auto_ai"
      battle_status:
        | "draft"
        | "open"
        | "lobby"
        | "launching"
        | "live"
        | "closing"
        | "finished"
        | "cancelled"
      report_status: "open" | "dismissed" | "actioned"
      report_target: "battle" | "side" | "message" | "profile"
      score_mode: "volume" | "holders" | "market_cap" | "composite"
      side_letter: "A" | "B"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      battle_mode: ["creator", "open_duel", "auto_ai"],
      battle_status: [
        "draft",
        "open",
        "lobby",
        "launching",
        "live",
        "closing",
        "finished",
        "cancelled",
      ],
      report_status: ["open", "dismissed", "actioned"],
      report_target: ["battle", "side", "message", "profile"],
      score_mode: ["volume", "holders", "market_cap", "composite"],
      side_letter: ["A", "B"],
    },
  },
} as const
