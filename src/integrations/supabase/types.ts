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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      advbox_report_schedules: {
        Row: {
          created_at: string | null
          email_recipients: string[] | null
          export_format: string
          id: string
          include_financial: boolean | null
          include_lawsuits: boolean | null
          include_publications: boolean | null
          include_tasks: boolean | null
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          report_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_recipients?: string[] | null
          export_format: string
          id?: string
          include_financial?: boolean | null
          include_lawsuits?: boolean | null
          include_publications?: boolean | null
          include_tasks?: boolean | null
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          report_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_recipients?: string[] | null
          export_format?: string
          id?: string
          include_financial?: boolean | null
          include_lawsuits?: boolean | null
          include_publications?: boolean | null
          include_tasks?: boolean | null
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          report_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      advbox_settings: {
        Row: {
          cache_ttl_minutes: number
          delay_between_requests_ms: number
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cache_ttl_minutes?: number
          delay_between_requests_ms?: number
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cache_ttl_minutes?: number
          delay_between_requests_ms?: number
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_agent_favorites: {
        Row: {
          agent_url: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agent_url: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agent_url?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_birthday_exclusions: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          excluded_by: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          excluded_by: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          excluded_by?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_gallery: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          photo_url: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          photo_url: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          photo_url?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_gallery"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_notifications: {
        Row: {
          created_at: string
          id: string
          mentioned_by: string
          post_id: string
          read: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_by: string
          post_id: string
          read?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_by?: string
          post_id?: string
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          last_post_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          last_post_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          last_post_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_materials: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          file_url: string
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          file_url: string
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_url?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          oab_number: string | null
          oab_state: string | null
          position: Database["public"]["Enums"]["position_type"] | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          oab_number?: string | null
          oab_state?: string | null
          position?: Database["public"]["Enums"]["position_type"] | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          oab_number?: string | null
          oab_state?: string | null
          position?: Database["public"]["Enums"]["position_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      suggestion_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          suggestion_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          suggestion_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          suggestion_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_tag_relations: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_tag_relations_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "suggestion_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_history: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          tool_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tool_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tool_name?: string
          user_id?: string
        }
        Relationships: []
      }
      useful_documents: {
        Row: {
          created_at: string
          description: string | null
          file_url: string
          id: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      approval_status: "pending" | "approved" | "rejected"
      position_type:
        | "socio"
        | "advogado"
        | "estagiario"
        | "comercial"
        | "administrativo"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      approval_status: ["pending", "approved", "rejected"],
      position_type: [
        "socio",
        "advogado",
        "estagiario",
        "comercial",
        "administrativo",
      ],
    },
  },
} as const
