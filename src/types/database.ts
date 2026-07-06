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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_lock: {
        Row: {
          id: string
          started_at: string
        }
        Insert: {
          id: string
          started_at: string
        }
        Update: {
          id?: string
          started_at?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          endpoint: string
          error_code: string | null
          id: string
          latency_ms: number | null
          model: string | null
          success: boolean
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          ads_payments: Json | null
          amount: number | null
          amount_paid: number | null
          company: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          email: string | null
          est_delivery: string | null
          id: string
          mrr: number | null
          name: string
          notes: string | null
          payments: Json | null
          phone: string | null
          solutions: string[] | null
          source: string | null
          stack_cost: number | null
          stack_detail: string | null
          stack_payments: Json | null
          stage: string | null
          start_date: string | null
          tasks: Json | null
          updated_at: string | null
        }
        Insert: {
          ads_payments?: Json | null
          amount?: number | null
          amount_paid?: number | null
          company?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          est_delivery?: string | null
          id?: string
          mrr?: number | null
          name: string
          notes?: string | null
          payments?: Json | null
          phone?: string | null
          solutions?: string[] | null
          source?: string | null
          stack_cost?: number | null
          stack_detail?: string | null
          stack_payments?: Json | null
          stage?: string | null
          start_date?: string | null
          tasks?: Json | null
          updated_at?: string | null
        }
        Update: {
          ads_payments?: Json | null
          amount?: number | null
          amount_paid?: number | null
          company?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          est_delivery?: string | null
          id?: string
          mrr?: number | null
          name?: string
          notes?: string | null
          payments?: Json | null
          phone?: string | null
          solutions?: string[] | null
          source?: string | null
          stack_cost?: number | null
          stack_detail?: string | null
          stack_payments?: Json | null
          stage?: string | null
          start_date?: string | null
          tasks?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      club_fires: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_fires_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "club_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      club_posts: {
        Row: {
          aspect_ratio: string
          avatar_url: string | null
          comments_count: number
          created_at: string
          fire_count: number
          id: string
          photo_url: string | null
          streak: number | null
          text: string | null
          user_id: string
          username: string | null
          workout_summary: string | null
        }
        Insert: {
          aspect_ratio?: string
          avatar_url?: string | null
          comments_count?: number
          created_at?: string
          fire_count?: number
          id?: string
          photo_url?: string | null
          streak?: number | null
          text?: string | null
          user_id: string
          username?: string | null
          workout_summary?: string | null
        }
        Update: {
          aspect_ratio?: string
          avatar_url?: string | null
          comments_count?: number
          created_at?: string
          fire_count?: number
          id?: string
          photo_url?: string | null
          streak?: number | null
          text?: string | null
          user_id?: string
          username?: string | null
          workout_summary?: string | null
        }
        Relationships: []
      }
      content: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          format: string | null
          id: string
          notes: string | null
          pillar: string | null
          platform: string | null
          scheduled_date: string | null
          source: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          pillar?: string | null
          platform?: string | null
          scheduled_date?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          pillar?: string | null
          platform?: string | null
          scheduled_date?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      exercise_videos: {
        Row: {
          created_at: string
          display_order: number
          duration_seconds: number | null
          exercise_id: string
          id: string
          label: string
          thumbnail_url: string | null
          updated_at: string
          variant_id: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_seconds?: number | null
          exercise_id: string
          id?: string
          label?: string
          thumbnail_url?: string | null
          updated_at?: string
          variant_id?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          label?: string
          thumbnail_url?: string | null
          updated_at?: string
          variant_id?: string | null
          video_url?: string
        }
        Relationships: []
      }
      food_log: {
        Row: {
          carbs: number
          created_at: string
          date: string
          description: string
          fat: number
          id: string
          kcal: number
          meal_index: number | null
          meal_time: string | null
          prot: number
          source: string
          user_id: string
        }
        Insert: {
          carbs?: number
          created_at?: string
          date: string
          description: string
          fat?: number
          id?: string
          kcal: number
          meal_index?: number | null
          meal_time?: string | null
          prot?: number
          source: string
          user_id: string
        }
        Update: {
          carbs?: number
          created_at?: string
          date?: string
          description?: string
          fat?: number
          id?: string
          kcal?: number
          prot?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      hogar_sesiones: {
        Row: {
          answers: Json | null
          created_at: string | null
          emo: number | null
          emo_name: string | null
          id: string
          path: string | null
          practica: string | null
          ritmo: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          emo?: number | null
          emo_name?: string | null
          id?: string
          path?: string | null
          practica?: string | null
          ritmo?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          emo?: number | null
          emo_name?: string | null
          id?: string
          path?: string | null
          practica?: string | null
          ritmo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          date: string | null
          deleted_at: string | null
          id: string
          investor: string | null
          notes: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string | null
          deleted_at?: string | null
          id?: string
          investor?: string | null
          notes?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string | null
          deleted_at?: string | null
          id?: string
          investor?: string | null
          notes?: string | null
          type?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          converted: boolean | null
          converted_client_id: string | null
          created_at: string | null
          email: string | null
          id: string
          ip: string | null
          message: string | null
          name: string | null
          page_url: string | null
          phone: string | null
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          company?: string | null
          converted?: boolean | null
          converted_client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          message?: string | null
          name?: string | null
          page_url?: string | null
          phone?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          company?: string | null
          converted?: boolean | null
          converted_client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          message?: string | null
          name?: string | null
          page_url?: string | null
          phone?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          assets: Json | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
          version: string | null
          week: number | null
        }
        Insert: {
          assets?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          version?: string | null
          week?: number | null
        }
        Update: {
          assets?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          version?: string | null
          week?: number | null
        }
        Relationships: []
      }
      meal_progress: {
        Row: {
          checked: boolean
          date: string
          id: string
          meal_index: number
          resolved_by_log: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          date: string
          id?: string
          meal_index: number
          resolved_by_log?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          date?: string
          id?: string
          meal_index?: number
          resolved_by_log?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_recipes: {
        Row: {
          created_at: string | null
          id: string
          meal_name: string
          steps: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meal_name: string
          steps: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meal_name?: string
          steps?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          created_at: string | null
          currency: string | null
          deadline: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          owner: string | null
          priority: string | null
          spent: number | null
          start_date: string | null
          status: string | null
          tasks: Json | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          created_at?: string | null
          currency?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          owner?: string | null
          priority?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          tasks?: Json | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          created_at?: string | null
          currency?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner?: string | null
          priority?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          tasks?: Json | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prospect_searches: {
        Row: {
          active: boolean | null
          city: string
          country: string | null
          created_at: string | null
          id: string
          last_run: string | null
          query: string
        }
        Insert: {
          active?: boolean | null
          city: string
          country?: string | null
          created_at?: string | null
          id?: string
          last_run?: string | null
          query: string
        }
        Update: {
          active?: boolean | null
          city?: string
          country?: string | null
          created_at?: string | null
          id?: string
          last_run?: string | null
          query?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          activity: string | null
          address: string | null
          business: string | null
          city: string | null
          created_at: string | null
          deleted_at: string | null
          dm_v4: string | null
          email: string | null
          email_opened: boolean | null
          email_opened_at: string | null
          email_v1: string | null
          email_v2: string | null
          email_v3: string | null
          emails_sent: number | null
          google_category: string | null
          google_maps_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_reviews: number | null
          google_types: string | null
          how_sells: Json | null
          id: string
          inferred_analysis: string | null
          inferred_how_sells: string | null
          inferred_operation: string | null
          inferred_pain: string | null
          inferred_system: string | null
          inferred_what_delivers: string | null
          instagram: string | null
          name: string | null
          notes: string | null
          operation: Json | null
          pain: string | null
          phone: string | null
          resend_id: string | null
          source: string | null
          stage: string | null
          subject_v1: string | null
          subject_v2: string | null
          subject_v3: string | null
          updated_at: string | null
          url: string | null
          what_delivers: Json | null
        }
        Insert: {
          activity?: string | null
          address?: string | null
          business?: string | null
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dm_v4?: string | null
          email?: string | null
          email_opened?: boolean | null
          email_opened_at?: string | null
          email_v1?: string | null
          email_v2?: string | null
          email_v3?: string | null
          emails_sent?: number | null
          google_category?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews?: number | null
          google_types?: string | null
          how_sells?: Json | null
          id?: string
          inferred_analysis?: string | null
          inferred_how_sells?: string | null
          inferred_operation?: string | null
          inferred_pain?: string | null
          inferred_system?: string | null
          inferred_what_delivers?: string | null
          instagram?: string | null
          name?: string | null
          notes?: string | null
          operation?: Json | null
          pain?: string | null
          phone?: string | null
          resend_id?: string | null
          source?: string | null
          stage?: string | null
          subject_v1?: string | null
          subject_v2?: string | null
          subject_v3?: string | null
          updated_at?: string | null
          url?: string | null
          what_delivers?: Json | null
        }
        Update: {
          activity?: string | null
          address?: string | null
          business?: string | null
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dm_v4?: string | null
          email?: string | null
          email_opened?: boolean | null
          email_opened_at?: string | null
          email_v1?: string | null
          email_v2?: string | null
          email_v3?: string | null
          emails_sent?: number | null
          google_category?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews?: number | null
          google_types?: string | null
          how_sells?: Json | null
          id?: string
          inferred_analysis?: string | null
          inferred_how_sells?: string | null
          inferred_operation?: string | null
          inferred_pain?: string | null
          inferred_system?: string | null
          inferred_what_delivers?: string | null
          instagram?: string | null
          name?: string | null
          notes?: string | null
          operation?: Json | null
          pain?: string | null
          phone?: string | null
          resend_id?: string | null
          source?: string | null
          stage?: string | null
          subject_v1?: string | null
          subject_v2?: string | null
          subject_v3?: string | null
          updated_at?: string | null
          url?: string | null
          what_delivers?: Json | null
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          alumnos_activos: number | null
          clientes_activos: number | null
          cobrado_total: number | null
          costo_ads: number | null
          costo_equipo: number | null
          costo_stack: number | null
          costo_tools: number | null
          costo_total: number | null
          created_at: string | null
          id: string
          inversion_mes: number | null
          invertido_mes: number | null
          month: string
          mrr_academia: number | null
          mrr_clientes: number | null
          notes: string | null
          num_alumnos: number | null
          num_clientes: number | null
          num_equipo: number | null
          num_leads: number | null
          revenue_mes: number | null
          team_activos: number | null
          tools_activos: number | null
          utilidad: number | null
        }
        Insert: {
          alumnos_activos?: number | null
          clientes_activos?: number | null
          cobrado_total?: number | null
          costo_ads?: number | null
          costo_equipo?: number | null
          costo_stack?: number | null
          costo_tools?: number | null
          costo_total?: number | null
          created_at?: string | null
          id?: string
          inversion_mes?: number | null
          invertido_mes?: number | null
          month: string
          mrr_academia?: number | null
          mrr_clientes?: number | null
          notes?: string | null
          num_alumnos?: number | null
          num_clientes?: number | null
          num_equipo?: number | null
          num_leads?: number | null
          revenue_mes?: number | null
          team_activos?: number | null
          tools_activos?: number | null
          utilidad?: number | null
        }
        Update: {
          alumnos_activos?: number | null
          clientes_activos?: number | null
          cobrado_total?: number | null
          costo_ads?: number | null
          costo_equipo?: number | null
          costo_stack?: number | null
          costo_tools?: number | null
          costo_total?: number | null
          created_at?: string | null
          id?: string
          inversion_mes?: number | null
          invertido_mes?: number | null
          month?: string
          mrr_academia?: number | null
          mrr_clientes?: number | null
          notes?: string | null
          num_alumnos?: number | null
          num_clientes?: number | null
          num_equipo?: number | null
          num_leads?: number | null
          revenue_mes?: number | null
          team_activos?: number | null
          tools_activos?: number | null
          utilidad?: number | null
        }
        Relationships: []
      }
      students: {
        Row: {
          amount: number | null
          amount_paid: number | null
          converted_to_client: boolean | null
          created_at: string | null
          currency: string | null
          current_week: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          plan: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          converted_to_client?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_week?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          plan?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          converted_to_client?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_week?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          plan?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team: {
        Row: {
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          email: string | null
          id: string
          invested: number | null
          name: string
          notes: string | null
          phone: string | null
          projects: string[] | null
          rate: number | null
          rate_type: string | null
          roles: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          invested?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          projects?: string[] | null
          rate?: number | null
          rate_type?: string | null
          roles?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          invested?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          projects?: string[] | null
          rate?: number | null
          rate_type?: string | null
          roles?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tools: {
        Row: {
          billing: string | null
          cancel_date: string | null
          category: string | null
          cost: number | null
          cost_history: Json | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          id: string
          login_email: string | null
          name: string
          notes: string | null
          paid_by: string | null
          paid_by_name: string | null
          renew_date: string | null
          status: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          billing?: string | null
          cancel_date?: string | null
          category?: string | null
          cost?: number | null
          cost_history?: Json | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          id?: string
          login_email?: string | null
          name: string
          notes?: string | null
          paid_by?: string | null
          paid_by_name?: string | null
          renew_date?: string | null
          status?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          billing?: string | null
          cancel_date?: string | null
          category?: string | null
          cost?: number | null
          cost_history?: Json | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          id?: string
          login_email?: string | null
          name?: string
          notes?: string | null
          paid_by?: string | null
          paid_by_name?: string | null
          renew_date?: string | null
          status?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      user_milestones: {
        Row: {
          created_at: string
          id: string
          milestone_days: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_days: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_days?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          blocked_exercises: string[] | null
          coaching_intensity: string | null
          created_at: string
          equipment_default: Json | null
          equipment_notes: string | null
          experiencia_anos: number | null
          lesiones: Json | null
          nivel: string | null
          preferred_days_per_week: number | null
          preferred_duration: number | null
          preferred_exercises: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_exercises?: string[] | null
          coaching_intensity?: string | null
          created_at?: string
          equipment_default?: Json | null
          equipment_notes?: string | null
          experiencia_anos?: number | null
          lesiones?: Json | null
          nivel?: string | null
          preferred_days_per_week?: number | null
          preferred_duration?: number | null
          preferred_exercises?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_exercises?: string[] | null
          coaching_intensity?: string | null
          created_at?: string
          equipment_default?: Json | null
          equipment_notes?: string | null
          experiencia_anos?: number | null
          lesiones?: Json | null
          nivel?: string | null
          preferred_days_per_week?: number | null
          preferred_duration?: number | null
          preferred_exercises?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          billing_cycle: string | null
          bio: string | null
          cancel_at_period_end: boolean
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          is_public: boolean | null
          last_active_date: string | null
          meal_plan_key: string | null
          ob_data: Json | null
          plan_goal: number | null
          plan_id: string | null
          shopping_day: number | null
          start_date: string | null
          streak_count: number
          stripe_customer_id: string | null
          subscription_period_end: string | null
          subscription_status: string
          payment_past_due: boolean
          tdee: number | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          user_plan: string | null
          weekly_plan: Json | null
          weekly_plan_updated_at: string | null
          daily_workout: Json | null
          daily_workout_updated_at: string | null
          daily_workout_regen: Json | null
          daily_workout_regen_updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_cycle?: string | null
          bio?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          is_public?: boolean | null
          last_active_date?: string | null
          meal_plan_key?: string | null
          ob_data?: Json | null
          plan_goal?: number | null
          plan_id?: string | null
          shopping_day?: number | null
          start_date?: string | null
          streak_count?: number
          stripe_customer_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string
          payment_past_due?: boolean
          tdee?: number | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          user_plan?: string | null
          weekly_plan?: Json | null
          weekly_plan_updated_at?: string | null
          daily_workout?: Json | null
          daily_workout_updated_at?: string | null
          daily_workout_regen?: Json | null
          daily_workout_regen_updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_cycle?: string | null
          bio?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          is_public?: boolean | null
          last_active_date?: string | null
          meal_plan_key?: string | null
          ob_data?: Json | null
          plan_goal?: number | null
          plan_id?: string | null
          shopping_day?: number | null
          start_date?: string | null
          streak_count?: number
          stripe_customer_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string
          payment_past_due?: boolean
          tdee?: number | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          user_plan?: string | null
          weekly_plan?: Json | null
          weekly_plan_updated_at?: string | null
          daily_workout?: Json | null
          daily_workout_updated_at?: string | null
          daily_workout_regen?: Json | null
          daily_workout_regen_updated_at?: string | null
        }
        Relationships: []
      }
      weight_log: {
        Row: {
          created_at: string
          date: string
          id: string
          kg: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          kg: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          kg?: number
          user_id?: string
        }
        Relationships: []
      }
      workout_cache: {
        Row: {
          config_hash: string
          created_at: string | null
          day_type: string
          duration: number
          equipment: string
          goal: string
          hits: number | null
          id: string
          updated_at: string | null
          workout_json: Json
        }
        Insert: {
          config_hash: string
          created_at?: string | null
          day_type: string
          duration: number
          equipment: string
          goal: string
          hits?: number | null
          id?: string
          updated_at?: string | null
          workout_json: Json
        }
        Update: {
          config_hash?: string
          created_at?: string | null
          day_type?: string
          duration?: number
          equipment?: string
          goal?: string
          hits?: number | null
          id?: string
          updated_at?: string | null
          workout_json?: Json
        }
        Relationships: []
      }
      workout_log: {
        Row: {
          coach_reason: string | null
          completed_at: string
          created_at: string
          date_local: string
          day_type: string | null
          discomfort: string | null
          duration_minutes: number
          energy: string | null
          equipment: string
          exercises: Json
          exercises_completed: number
          exercises_total: number
          generation_method: string | null
          id: string
          modality: string
          pain_area: string | null
          prior_exercise: string | null
          target_duration_minutes: number
          total_volume_kg: number | null
          updated_at: string
          user_feeling: string | null
          user_id: string
          user_notes: string | null
        }
        Insert: {
          coach_reason?: string | null
          completed_at?: string
          created_at?: string
          date_local: string
          day_type?: string | null
          discomfort?: string | null
          duration_minutes: number
          energy?: string | null
          equipment: string
          exercises?: Json
          exercises_completed?: number
          exercises_total?: number
          generation_method?: string | null
          id?: string
          modality: string
          pain_area?: string | null
          prior_exercise?: string | null
          target_duration_minutes: number
          total_volume_kg?: number | null
          updated_at?: string
          user_feeling?: string | null
          user_id: string
          user_notes?: string | null
        }
        Update: {
          coach_reason?: string | null
          completed_at?: string
          created_at?: string
          date_local?: string
          day_type?: string | null
          discomfort?: string | null
          duration_minutes?: number
          energy?: string | null
          equipment?: string
          exercises?: Json
          exercises_completed?: number
          exercises_total?: number
          generation_method?: string | null
          id?: string
          modality?: string
          pain_area?: string | null
          prior_exercise?: string | null
          target_duration_minutes?: number
          total_volume_kg?: number | null
          updated_at?: string
          user_feeling?: string | null
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      tools_safe: {
        Row: {
          billing: string | null
          category: string | null
          id: string | null
          name: string | null
          status: string | null
        }
        Insert: {
          billing?: string | null
          category?: string | null
          id?: string | null
          name?: string | null
          status?: string | null
        }
        Update: {
          billing?: string | null
          category?: string | null
          id?: string | null
          name?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
