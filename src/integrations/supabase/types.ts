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
      image_feedback: {
        Row: {
          created_at: string | null
          expected_subtitle: string | null
          expected_title: string | null
          id: string
          image_id: string | null
          issues: Json | null
          notes: string | null
          project_id: string | null
          rating: number | null
          text_accuracy: string | null
        }
        Insert: {
          created_at?: string | null
          expected_subtitle?: string | null
          expected_title?: string | null
          id?: string
          image_id?: string | null
          issues?: Json | null
          notes?: string | null
          project_id?: string | null
          rating?: number | null
          text_accuracy?: string | null
        }
        Update: {
          created_at?: string | null
          expected_subtitle?: string | null
          expected_title?: string | null
          id?: string
          image_id?: string | null
          issues?: Json | null
          notes?: string | null
          project_id?: string | null
          rating?: number | null
          text_accuracy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_feedback_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          ai_prompt: string | null
          approved_version: number | null
          asset_name: string | null
          created_at: string | null
          edited_url: string | null
          error_message: string | null
          id: string
          image_number: number
          needs_review: boolean | null
          ocr_extracted_text: string | null
          original_filename: string
          original_url: string
          processing_time_ms: number | null
          project_id: string | null
          retry_count: number | null
          retry_history: Json | null
          status: string
          subtitle: string | null
          text_accuracy_score: number | null
          title: string | null
          updated_at: string | null
          variant: string | null
        }
        Insert: {
          ai_prompt?: string | null
          approved_version?: number | null
          asset_name?: string | null
          created_at?: string | null
          edited_url?: string | null
          error_message?: string | null
          id?: string
          image_number: number
          needs_review?: boolean | null
          ocr_extracted_text?: string | null
          original_filename: string
          original_url: string
          processing_time_ms?: number | null
          project_id?: string | null
          retry_count?: number | null
          retry_history?: Json | null
          status?: string
          subtitle?: string | null
          text_accuracy_score?: number | null
          title?: string | null
          updated_at?: string | null
          variant?: string | null
        }
        Update: {
          ai_prompt?: string | null
          approved_version?: number | null
          asset_name?: string | null
          created_at?: string | null
          edited_url?: string | null
          error_message?: string | null
          id?: string
          image_number?: number
          needs_review?: boolean | null
          ocr_extracted_text?: string | null
          original_filename?: string
          original_url?: string
          processing_time_ms?: number | null
          project_id?: string | null
          retry_count?: number | null
          retry_history?: Json | null
          status?: string
          subtitle?: string | null
          text_accuracy_score?: number | null
          title?: string | null
          updated_at?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          brand_preset: Json | null
          completed_images: number | null
          created_at: string | null
          id: string
          name: string
          pdf_filename: string | null
          pdf_url: string | null
          status: string
          total_images: number | null
          updated_at: string | null
        }
        Insert: {
          brand_preset?: Json | null
          completed_images?: number | null
          created_at?: string | null
          id?: string
          name: string
          pdf_filename?: string | null
          pdf_url?: string | null
          status?: string
          total_images?: number | null
          updated_at?: string | null
        }
        Update: {
          brand_preset?: Json | null
          completed_images?: number | null
          created_at?: string | null
          id?: string
          name?: string
          pdf_filename?: string | null
          pdf_url?: string | null
          status?: string
          total_images?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
