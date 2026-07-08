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
          dispatch_hangup_sent_at: string | null
          dispatch_no_payment_sent_at: string | null
          dispatch_paid_at: string | null
          dispatch_post_payment_sent_at: string | null
          dispatch_reason: string | null
          dispatch_scheduled_at: string | null
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
          payment_button_shown_at: string | null
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
          dispatch_hangup_sent_at?: string | null
          dispatch_no_payment_sent_at?: string | null
          dispatch_paid_at?: string | null
          dispatch_post_payment_sent_at?: string | null
          dispatch_reason?: string | null
          dispatch_scheduled_at?: string | null
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
          payment_button_shown_at?: string | null
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
          dispatch_hangup_sent_at?: string | null
          dispatch_no_payment_sent_at?: string | null
          dispatch_paid_at?: string | null
          dispatch_post_payment_sent_at?: string | null
          dispatch_reason?: string | null
          dispatch_scheduled_at?: string | null
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
          payment_button_shown_at?: string | null
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
          kind: string
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
          kind?: string
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
          kind?: string
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
          dispatch_button_text: string
          dispatch_copy_hangup: string
          dispatch_copy_no_payment: string
          dispatch_copy_post_payment: string
          dispatch_price_cents: number
          free_duration_seconds: number
          id: number
          mini_app_url: string | null
          model_name: string
          model_photo_url: string | null
          offer_subtitle: string
          offer_title: string
          price_cents: number
          start_button_text: string
          start_message: string
          start_photo_url: string | null
          start_video_url: string | null
          telegram_bot_username: string | null
          telegram_copy_template: string
          telegram_purchase_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          contact_url?: string | null
          created_at?: string
          dispatch_button_text?: string
          dispatch_copy_hangup?: string
          dispatch_copy_no_payment?: string
          dispatch_copy_post_payment?: string
          dispatch_price_cents?: number
          free_duration_seconds?: number
          id?: number
          mini_app_url?: string | null
          model_name?: string
          model_photo_url?: string | null
          offer_subtitle?: string
          offer_title?: string
          price_cents?: number
          start_button_text?: string
          start_message?: string
          start_photo_url?: string | null
          start_video_url?: string | null
          telegram_bot_username?: string | null
          telegram_copy_template?: string
          telegram_purchase_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          contact_url?: string | null
          created_at?: string
          dispatch_button_text?: string
          dispatch_copy_hangup?: string
          dispatch_copy_no_payment?: string
          dispatch_copy_post_payment?: string
          dispatch_price_cents?: number
          free_duration_seconds?: number
          id?: number
          mini_app_url?: string | null
          model_name?: string
          model_photo_url?: string | null
          offer_subtitle?: string
          offer_title?: string
          price_cents?: number
          start_button_text?: string
          start_message?: string
          start_photo_url?: string | null
          start_video_url?: string | null
          telegram_bot_username?: string | null
          telegram_copy_template?: string
          telegram_purchase_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      telegram_contacts: {
        Row: {
          chat_id: number
          created_at: string
          first_name: string | null
          phone: string
          updated_at: string
          user_id: number | null
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          first_name?: string | null
          phone: string
          updated_at?: string
          user_id?: number | null
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          first_name?: string | null
          phone?: string
          updated_at?: string
          user_id?: number | null
          username?: string | null
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
      app_cancel_dispatch: { Args: { _session_id: string }; Returns: undefined }
      app_clear_dispatch_queue: {
        Args: { _clear_reason?: boolean; _session_id: string }
        Returns: undefined
      }
      app_complete_call: { Args: { _session_id: string }; Returns: undefined }
      app_end_free_call: { Args: { _session_id: string }; Returns: undefined }
      app_get_abandoned_dispatches: {
        Args: { _cutoff: string }
        Returns: {
          free_ended_at: string
          id: string
        }[]
      }
      app_get_dispatch_payload: {
        Args: { _reason: string; _session_id: string }
        Returns: {
          dispatch_button_text: string
          dispatch_copy_hangup: string
          dispatch_copy_no_payment: string
          dispatch_copy_post_payment: string
          geo_city: string
          geo_country: string
          geo_lat: number
          geo_lng: number
          geo_region: string
          id: string
          mini_app_url: string
          model_name: string
          phone: string
          recording_path: string
          telegram_chat_id: number
        }[]
      }
      app_get_due_dispatches: {
        Args: { _now?: string }
        Returns: {
          dispatch_reason: string
          id: string
          telegram_chat_id: number
        }[]
      }
      app_get_existing_dispatch_payment: {
        Args: { _session_id: string }
        Returns: {
          amount_cents: number
          id: string
          qr_code: string
          qr_code_base64: string
          status: string
          ticket_url: string
        }[]
      }
      app_get_free_duration: { Args: never; Returns: number }
      app_get_payment_for_check: {
        Args: { _payment_id: string }
        Returns: {
          id: string
          kind: string
          provider_payment_id: string
          session_id: string
          status: string
        }[]
      }
      app_get_session_payment_context: {
        Args: { _session_id: string }
        Returns: {
          phone: string
        }[]
      }
      app_insert_payment: {
        Args: {
          _amount_cents: number
          _kind: string
          _provider: string
          _provider_payment_id: string
          _qr_code?: string
          _qr_code_base64?: string
          _session_id: string
          _status: string
          _ticket_url?: string
        }
        Returns: string
      }
      app_mark_dispatch_sent: {
        Args: { _reason: string; _session_id: string }
        Returns: undefined
      }
      app_save_lead_phone: {
        Args: { _phone: string; _session_id: string }
        Returns: undefined
      }
      app_set_recording_path: {
        Args: { _path: string; _session_id: string }
        Returns: undefined
      }
      app_start_call_session: {
        Args: {
          _consent: boolean
          _geo_city?: string
          _geo_country?: string
          _geo_lat?: number
          _geo_lng?: number
          _geo_region?: string
          _ip?: string
          _telegram_chat_id?: number
          _telegram_username?: string
          _user_agent?: string
        }
        Returns: string
      }
      app_update_payment_after_check: {
        Args: { _payment_id: string; _status: string }
        Returns: string
      }
      app_update_session_geo: {
        Args: {
          _accuracy: number
          _lat: number
          _lng: number
          _session_id: string
        }
        Returns: undefined
      }
      app_upsert_telegram_contact: {
        Args: {
          _chat_id: number
          _first_name: string
          _phone: string
          _user_id: number
          _username: string
        }
        Returns: undefined
      }
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
