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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      call_sessions: {
        Row: {
          completed_at: string | null
          consent_recording: boolean
          created_at: string
          free_ended_at: string | null
          geo_accuracy: number | null
          geo_city: string | null
          geo_country: string | null
          geo_lat: number | null
          geo_lng: number | null
          geo_region: string | null
          has_paid: boolean
          id: string
          ip: string | null
          paid_at: string | null
          phone: string | null
          recording_path: string | null
          status: string
          telegram_chat_id: number | null
          telegram_sent_at: string | null
          telegram_username: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          completed_at?: string | null
          consent_recording?: boolean
          created_at?: string
          free_ended_at?: string | null
          geo_accuracy?: number | null
          geo_city?: string | null
          geo_country?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_region?: string | null
          has_paid?: boolean
          id?: string
          ip?: string | null
          paid_at?: string | null
          phone?: string | null
          recording_path?: string | null
          status?: string
          telegram_chat_id?: number | null
          telegram_sent_at?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          completed_at?: string | null
          consent_recording?: boolean
          created_at?: string
          free_ended_at?: string | null
          geo_accuracy?: number | null
          geo_city?: string | null
          geo_country?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_region?: string | null
          has_paid?: boolean
          id?: string
          ip?: string | null
          paid_at?: string | null
          phone?: string | null
          recording_path?: string | null
          status?: string
          telegram_chat_id?: number | null
          telegram_sent_at?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          provider: string
          provider_payment_id: string | null
          qr_code: string | null
          qr_code_base64: string | null
          session_id: string | null
          status: string
          ticket_url: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          session_id?: string | null
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          session_id?: string | null
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          contact_url: string | null
          created_at: string
          free_duration_seconds: number
          id: number
          model_name: string
          model_photo_url: string | null
          offer_subtitle: string
          offer_title: string
          price_cents: number
          telegram_bot_username: string | null
          telegram_copy_template: string
          telegram_purchase_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          contact_url?: string | null
          created_at?: string
          free_duration_seconds?: number
          id?: number
          model_name?: string
          model_photo_url?: string | null
          offer_subtitle?: string
          offer_title?: string
          price_cents?: number
          telegram_bot_username?: string | null
          telegram_copy_template?: string
          telegram_purchase_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          contact_url?: string | null
          created_at?: string
          free_duration_seconds?: number
          id?: number
          model_name?: string
          model_photo_url?: string | null
          offer_subtitle?: string
          offer_title?: string
          price_cents?: number
          telegram_bot_username?: string | null
          telegram_copy_template?: string
          telegram_purchase_url?: string | null
          updated_at?: string
          video_url?: string | null
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
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
