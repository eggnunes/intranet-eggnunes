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
      admin_permissions: {
        Row: {
          admin_user_id: string
          created_at: string
          created_by: string
          id: string
          perm_admin_requests: string
          perm_advbox: string
          perm_announcements: string
          perm_birthdays: string
          perm_collection: string
          perm_copa_cozinha: string
          perm_documents: string
          perm_events: string
          perm_financial: string
          perm_forum: string
          perm_home_office: string
          perm_lead_tracking: string
          perm_onboarding: string
          perm_recruitment: string
          perm_suggestions: string
          perm_task_rules: string
          perm_users: string
          perm_vacation: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          created_by: string
          id?: string
          perm_admin_requests?: string
          perm_advbox?: string
          perm_announcements?: string
          perm_birthdays?: string
          perm_collection?: string
          perm_copa_cozinha?: string
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_home_office?: string
          perm_lead_tracking?: string
          perm_onboarding?: string
          perm_recruitment?: string
          perm_suggestions?: string
          perm_task_rules?: string
          perm_users?: string
          perm_vacation?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          created_by?: string
          id?: string
          perm_admin_requests?: string
          perm_advbox?: string
          perm_announcements?: string
          perm_birthdays?: string
          perm_collection?: string
          perm_copa_cozinha?: string
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_home_office?: string
          perm_lead_tracking?: string
          perm_onboarding?: string
          perm_recruitment?: string
          perm_suggestions?: string
          perm_task_rules?: string
          perm_users?: string
          perm_vacation?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_task_notification_recipients: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          receive_due_soon_alerts: boolean
          receive_due_today_alerts: boolean
          receive_overdue_alerts: boolean
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          receive_due_soon_alerts?: boolean
          receive_due_today_alerts?: boolean
          receive_overdue_alerts?: boolean
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          receive_due_soon_alerts?: boolean
          receive_due_today_alerts?: boolean
          receive_overdue_alerts?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      administrative_requests: {
        Row: {
          created_at: string
          description: string
          handled_at: string | null
          handled_by: string | null
          id: string
          priority: string
          request_type: string
          resolution_notes: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          priority?: string
          request_type: string
          resolution_notes?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          priority?: string
          request_type?: string
          resolution_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          model: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_message_favorites: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          model: string
          notes: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          model: string
          notes?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          model?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          images: Json | null
          role: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          images?: Json | null
          role: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          images?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          prompt: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          prompt: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          prompt?: string
          title?: string
          updated_at?: string
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
      captured_leads: {
        Row: {
          created_at: string
          email: string | null
          form_id: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          name: string
          phone: string
          product_name: string | null
          rd_station_sync_error: string | null
          rd_station_synced: boolean | null
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          form_id?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          name: string
          phone: string
          product_name?: string | null
          rd_station_sync_error?: string | null
          rd_station_synced?: boolean | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          form_id?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          name?: string
          phone?: string
          product_name?: string | null
          rd_station_sync_error?: string | null
          rd_station_synced?: boolean | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captured_leads_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_capture_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      chatguru_birthday_messages_log: {
        Row: {
          chatguru_message_id: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          error_message: string | null
          id: string
          message_text: string
          sent_at: string | null
          status: string
        }
        Insert: {
          chatguru_message_id?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          error_message?: string | null
          id?: string
          message_text: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          chatguru_message_id?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          error_message?: string | null
          id?: string
          message_text?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      collection_rules: {
        Row: {
          created_at: string | null
          created_by: string
          days_overdue: number
          id: string
          is_active: boolean | null
          name: string
          send_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          days_overdue: number
          id?: string
          is_active?: boolean | null
          name: string
          send_time?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          days_overdue?: number
          id?: string
          is_active?: boolean | null
          name?: string
          send_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contra_partida_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contract_drafts: {
        Row: {
          clausula_exito_gerada: string | null
          clausula_primeira_gerada: string | null
          client_id: number
          client_name: string
          contra_partida: string | null
          contract_preview_text: string | null
          created_at: string
          data_vencimento: string | null
          descricao_honorarios_exito: string | null
          forma_pagamento: string | null
          id: string
          numero_parcelas: string | null
          objeto_contrato: string | null
          product_name: string
          qualification: string
          tem_entrada: boolean | null
          tem_honorarios_exito: boolean | null
          tipo_honorarios: string | null
          updated_at: string
          user_id: string
          valor_entrada: string | null
          valor_parcela: string | null
          valor_total: string | null
        }
        Insert: {
          clausula_exito_gerada?: string | null
          clausula_primeira_gerada?: string | null
          client_id: number
          client_name: string
          contra_partida?: string | null
          contract_preview_text?: string | null
          created_at?: string
          data_vencimento?: string | null
          descricao_honorarios_exito?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: string | null
          objeto_contrato?: string | null
          product_name: string
          qualification: string
          tem_entrada?: boolean | null
          tem_honorarios_exito?: boolean | null
          tipo_honorarios?: string | null
          updated_at?: string
          user_id: string
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Update: {
          clausula_exito_gerada?: string | null
          clausula_primeira_gerada?: string | null
          client_id?: number
          client_name?: string
          contra_partida?: string | null
          contract_preview_text?: string | null
          created_at?: string
          data_vencimento?: string | null
          descricao_honorarios_exito?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: string | null
          objeto_contrato?: string | null
          product_name?: string
          qualification?: string
          tem_entrada?: boolean | null
          tem_honorarios_exito?: boolean | null
          tipo_honorarios?: string | null
          updated_at?: string
          user_id?: string
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          rd_station_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          rd_station_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          rd_station_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_tags: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          tag_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          tag_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          tag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          address: string | null
          birthday: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          facebook: string | null
          first_conversion: string | null
          id: string
          job_title: string | null
          last_conversion: string | null
          lead_score: number | null
          linkedin: string | null
          name: string
          notes: string | null
          phone: string | null
          rd_station_id: string | null
          state: string | null
          traffic_campaign: string | null
          traffic_medium: string | null
          traffic_source: string | null
          twitter: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          facebook?: string | null
          first_conversion?: string | null
          id?: string
          job_title?: string | null
          last_conversion?: string | null
          lead_score?: number | null
          linkedin?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          rd_station_id?: string | null
          state?: string | null
          traffic_campaign?: string | null
          traffic_medium?: string | null
          traffic_source?: string | null
          twitter?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          birthday?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          facebook?: string | null
          first_conversion?: string | null
          id?: string
          job_title?: string | null
          last_conversion?: string | null
          lead_score?: number | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          rd_station_id?: string | null
          state?: string | null
          traffic_campaign?: string | null
          traffic_medium?: string | null
          traffic_source?: string | null
          twitter?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Relationships: []
      }
      crm_deal_history: {
        Row: {
          changed_by: string | null
          created_at: string
          deal_id: string | null
          from_stage_id: string | null
          id: string
          notes: string | null
          to_stage_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          deal_id?: string | null
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          deal_id?: string | null
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_stages: {
        Row: {
          created_at: string
          id: string
          is_lost: boolean | null
          is_won: boolean | null
          name: string
          order_index: number
          pipeline_id: string | null
          rd_station_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name: string
          order_index?: number
          pipeline_id?: string | null
          rd_station_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name?: string
          order_index?: number
          pipeline_id?: string | null
          rd_station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          campaign_name: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          custom_fields: Json | null
          expected_close_date: string | null
          id: string
          loss_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string | null
          product_name: string | null
          rd_station_id: string | null
          stage_id: string | null
          updated_at: string
          value: number | null
          won: boolean | null
        }
        Insert: {
          campaign_name?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          product_name?: string | null
          rd_station_id?: string | null
          stage_id?: string | null
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Update: {
          campaign_name?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          product_name?: string | null
          rd_station_id?: string | null
          stage_id?: string | null
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          rd_station_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          rd_station_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          rd_station_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_settings: {
        Row: {
          created_at: string
          id: string
          last_full_sync_at: string | null
          rd_station_sync_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_full_sync_at?: string | null
          rd_station_sync_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_full_sync_at?: string | null
          rd_station_sync_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      crm_sync_log: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          status: string
          sync_type: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      crm_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          rd_station_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          rd_station_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          rd_station_id?: string | null
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
      defaulter_exclusions: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          excluded_by: string
          id: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          excluded_by: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          excluded_by?: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      defaulter_messages_log: {
        Row: {
          chatguru_message_id: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          days_overdue: number
          error_message: string | null
          id: string
          message_template: string
          message_text: string
          sent_at: string | null
          sent_by: string
          status: string | null
        }
        Insert: {
          chatguru_message_id?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          days_overdue: number
          error_message?: string | null
          id?: string
          message_template: string
          message_text: string
          sent_at?: string | null
          sent_by: string
          status?: string | null
        }
        Update: {
          chatguru_message_id?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          days_overdue?: number
          error_message?: string | null
          id?: string
          message_template?: string
          message_text?: string
          sent_at?: string | null
          sent_by?: string
          status?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
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
      financial_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          period: string
          threshold_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period: string
          threshold_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period?: string
          threshold_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          created_at: string | null
          goal_type: string
          id: string
          is_active: boolean | null
          month: number | null
          quarter: number | null
          target_value: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          month?: number | null
          quarter?: number | null
          target_value: number
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          month?: number | null
          quarter?: number | null
          target_value?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      food_items: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          normalized_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          normalized_name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          normalized_name?: string
        }
        Relationships: []
      }
      food_purchase_status: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          food_item_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          food_item_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          food_item_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_purchase_status_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_suggestions: {
        Row: {
          created_at: string
          food_item_id: string
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          food_item_id: string
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          food_item_id?: string
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_suggestions_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
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
      home_office_schedules: {
        Row: {
          created_at: string
          created_by: string
          day_of_week: number
          id: string
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_week: number
          id?: string
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_week?: number
          id?: string
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      home_office_swap_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          requester_original_date: string
          responded_at: string | null
          status: string
          target_id: string
          target_original_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          requester_original_date: string
          responded_at?: string | null
          status?: string
          target_id: string
          target_original_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          requester_original_date?: string
          responded_at?: string | null
          status?: string
          target_id?: string
          target_original_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      initial_fee_templates: {
        Row: {
          created_at: string
          descricao: string | null
          forma_pagamento: string | null
          forma_pagamento_entrada: string | null
          forma_pagamento_parcelas: string | null
          id: string
          is_default: boolean | null
          name: string
          numero_parcelas: string | null
          tem_entrada: boolean | null
          tipo_honorarios: string
          updated_at: string
          user_id: string | null
          valor_entrada: string | null
          valor_parcela: string | null
          valor_total: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          forma_pagamento_entrada?: string | null
          forma_pagamento_parcelas?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          numero_parcelas?: string | null
          tem_entrada?: boolean | null
          tipo_honorarios?: string
          updated_at?: string
          user_id?: string | null
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          forma_pagamento_entrada?: string | null
          forma_pagamento_parcelas?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          numero_parcelas?: string | null
          tem_entrada?: boolean | null
          tipo_honorarios?: string
          updated_at?: string
          user_id?: string | null
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Relationships: []
      }
      intranet_update_reads: {
        Row: {
          id: string
          read_at: string
          update_id: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string
          update_id: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_update_reads_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "intranet_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_updates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      jurisprudence_searches: {
        Row: {
          created_at: string
          id: string
          query: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          response: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      landing_page_product_mappings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          product_name: string
          updated_at: string
          url_pattern: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          product_name: string
          updated_at?: string
          url_pattern: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          product_name?: string
          updated_at?: string
          url_pattern?: string
        }
        Relationships: []
      }
      lead_capture_forms: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          redirect_to_whatsapp: boolean | null
          updated_at: string
          whatsapp_message: string | null
          whatsapp_number: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          redirect_to_whatsapp?: boolean | null
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_number: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          redirect_to_whatsapp?: boolean | null
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_capture_forms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "utm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_room_bookings: {
        Row: {
          booking_date: string
          created_at: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      objeto_contrato_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
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
      position_permission_defaults: {
        Row: {
          created_at: string
          id: string
          is_admin_group: boolean | null
          perm_admin_requests: string
          perm_advbox: string
          perm_announcements: string
          perm_birthdays: string
          perm_collection: string
          perm_copa_cozinha: string
          perm_documents: string
          perm_events: string
          perm_financial: string
          perm_forum: string
          perm_home_office: string
          perm_lead_tracking: string
          perm_onboarding: string
          perm_recruitment: string
          perm_suggestions: string
          perm_task_rules: string
          perm_users: string
          perm_vacation: string
          position: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_group?: boolean | null
          perm_admin_requests?: string
          perm_advbox?: string
          perm_announcements?: string
          perm_birthdays?: string
          perm_collection?: string
          perm_copa_cozinha?: string
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_home_office?: string
          perm_lead_tracking?: string
          perm_onboarding?: string
          perm_recruitment?: string
          perm_suggestions?: string
          perm_task_rules?: string
          perm_users?: string
          perm_vacation?: string
          position: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_group?: boolean | null
          perm_admin_requests?: string
          perm_advbox?: string
          perm_announcements?: string
          perm_birthdays?: string
          perm_collection?: string
          perm_copa_cozinha?: string
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_home_office?: string
          perm_lead_tracking?: string
          perm_onboarding?: string
          perm_recruitment?: string
          perm_suggestions?: string
          perm_task_rules?: string
          perm_users?: string
          perm_vacation?: string
          position?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_template_associations: {
        Row: {
          contra_partida_template_id: string | null
          created_at: string
          id: string
          objeto_contrato_template_id: string | null
          product_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contra_partida_template_id?: string | null
          created_at?: string
          id?: string
          objeto_contrato_template_id?: string | null
          product_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contra_partida_template_id?: string | null
          created_at?: string
          id?: string
          objeto_contrato_template_id?: string | null
          product_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_template_associations_contra_partida_template_id_fkey"
            columns: ["contra_partida_template_id"]
            isOneToOne: false
            referencedRelation: "contra_partida_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_template_associations_objeto_contrato_template_id_fkey"
            columns: ["objeto_contrato_template_id"]
            isOneToOne: false
            referencedRelation: "objeto_contrato_templates"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          join_date: string | null
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
          is_active?: boolean
          join_date?: string | null
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
          is_active?: boolean
          join_date?: string | null
          oab_number?: string | null
          oab_state?: string | null
          position?: Database["public"]["Enums"]["position_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      publication_reads: {
        Row: {
          created_at: string
          id: string
          lawsuit_id: number
          movement_date: string
          movement_title: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lawsuit_id: number
          movement_date: string
          movement_title: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lawsuit_id?: number
          movement_date?: string
          movement_title?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recruitment_candidate_documents: {
        Row: {
          candidate_id: string
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          document_type?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidates: {
        Row: {
          created_at: string
          created_by: string
          current_stage: Database["public"]["Enums"]["recruitment_stage"]
          elimination_notes: string | null
          elimination_reason:
            | Database["public"]["Enums"]["elimination_reason"]
            | null
          email: string | null
          extracted_data: Json | null
          full_name: string
          future_hire_notes: string | null
          hired_date: string | null
          id: string
          in_person_interview_date: string | null
          interview_date: string | null
          is_active: boolean
          is_future_hire_candidate: boolean | null
          job_opening_id: string | null
          phone: string | null
          position_applied: string | null
          previous_job_opening_id: string | null
          resume_file_name: string | null
          resume_url: string | null
          test_date: string | null
          test_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_stage?: Database["public"]["Enums"]["recruitment_stage"]
          elimination_notes?: string | null
          elimination_reason?:
            | Database["public"]["Enums"]["elimination_reason"]
            | null
          email?: string | null
          extracted_data?: Json | null
          full_name: string
          future_hire_notes?: string | null
          hired_date?: string | null
          id?: string
          in_person_interview_date?: string | null
          interview_date?: string | null
          is_active?: boolean
          is_future_hire_candidate?: boolean | null
          job_opening_id?: string | null
          phone?: string | null
          position_applied?: string | null
          previous_job_opening_id?: string | null
          resume_file_name?: string | null
          resume_url?: string | null
          test_date?: string | null
          test_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_stage?: Database["public"]["Enums"]["recruitment_stage"]
          elimination_notes?: string | null
          elimination_reason?:
            | Database["public"]["Enums"]["elimination_reason"]
            | null
          email?: string | null
          extracted_data?: Json | null
          full_name?: string
          future_hire_notes?: string | null
          hired_date?: string | null
          id?: string
          in_person_interview_date?: string | null
          interview_date?: string | null
          is_active?: boolean
          is_future_hire_candidate?: boolean | null
          job_opening_id?: string | null
          phone?: string | null
          position_applied?: string | null
          previous_job_opening_id?: string | null
          resume_file_name?: string | null
          resume_url?: string | null
          test_date?: string | null
          test_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "recruitment_job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_previous_job_opening_id_fkey"
            columns: ["previous_job_opening_id"]
            isOneToOne: false
            referencedRelation: "recruitment_job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interview_feedback: {
        Row: {
          additional_notes: string | null
          communication: number | null
          created_at: string
          cultural_fit: number | null
          evaluator_id: string
          experience: number | null
          id: string
          interview_id: string
          motivation: number | null
          overall_rating: number | null
          problem_solving: number | null
          recommendation: string | null
          strengths: string | null
          technical_skills: number | null
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          additional_notes?: string | null
          communication?: number | null
          created_at?: string
          cultural_fit?: number | null
          evaluator_id: string
          experience?: number | null
          id?: string
          interview_id: string
          motivation?: number | null
          overall_rating?: number | null
          problem_solving?: number | null
          recommendation?: string | null
          strengths?: string | null
          technical_skills?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          additional_notes?: string | null
          communication?: number | null
          created_at?: string
          cultural_fit?: number | null
          evaluator_id?: string
          experience?: number | null
          id?: string
          interview_id?: string
          motivation?: number | null
          overall_rating?: number | null
          problem_solving?: number | null
          recommendation?: string | null
          strengths?: string | null
          technical_skills?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interview_feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "recruitment_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interviews: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string
          duration_minutes: number | null
          feedback: string | null
          id: string
          interview_type: string
          interviewer_ids: string[]
          location: string | null
          meeting_link: string | null
          notes: string | null
          rating: number | null
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interview_type: string
          interviewer_ids?: string[]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          rating?: number | null
          scheduled_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interview_type?: string
          interviewer_ids?: string[]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          rating?: number | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_job_openings: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          opened_at: string
          position: string
          requirements: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          opened_at?: string
          position: string
          requirements?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          opened_at?: string
          position?: string
          requirements?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_notes: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_position_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          position: string
          requirements: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          position: string
          requirements?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          position?: string
          requirements?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_stage_history: {
        Row: {
          candidate_id: string
          changed_by: string
          created_at: string
          from_stage: Database["public"]["Enums"]["recruitment_stage"] | null
          id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["recruitment_stage"]
        }
        Insert: {
          candidate_id: string
          changed_by: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["recruitment_stage"] | null
          id?: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["recruitment_stage"]
        }
        Update: {
          candidate_id?: string
          changed_by?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["recruitment_stage"] | null
          id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["recruitment_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_stage_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jurisprudence: {
        Row: {
          category: string | null
          content: string
          court: string | null
          created_at: string
          id: string
          notes: string | null
          search_id: string | null
          source: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          court?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          search_id?: string | null
          source?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          court?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          search_id?: string | null
          source?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jurisprudence_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "jurisprudence_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      special_powers_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      success_fee_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
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
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_auto_rules: {
        Row: {
          created_at: string | null
          created_by: string
          days_to_deadline: number | null
          id: string
          is_active: boolean | null
          name: string
          responsible_user_id: string | null
          task_description_template: string | null
          task_title_template: string
          task_type_id: number
          trigger_type: string
          trigger_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          days_to_deadline?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          responsible_user_id?: string | null
          task_description_template?: string | null
          task_title_template: string
          task_type_id: number
          trigger_type: string
          trigger_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          days_to_deadline?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          responsible_user_id?: string | null
          task_description_template?: string | null
          task_title_template?: string
          task_type_id?: number
          trigger_type?: string
          trigger_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_notification_settings: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          notification_time: string
          notify_days_before: number
          notify_on_due_date: boolean
          notify_when_overdue: boolean
          push_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          notification_time?: string
          notify_days_before?: number
          notify_on_due_date?: boolean
          notify_when_overdue?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          notification_time?: string
          notify_days_before?: number
          notify_on_due_date?: boolean
          notify_when_overdue?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_priorities: {
        Row: {
          created_at: string
          id: string
          priority: string
          set_by: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority: string
          set_by: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          set_by?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          new_status: string
          notes: string | null
          previous_status: string | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          previous_status?: string | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          previous_status?: string | null
          task_id?: string
        }
        Relationships: []
      }
      totp_accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          secret_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          secret_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          secret_key?: string
          updated_at?: string | null
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
      user_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
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
      utm_campaigns: {
        Row: {
          base_url: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          utm_term: string | null
          whatsapp_number: string | null
        }
        Insert: {
          base_url: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
          utm_campaign: string
          utm_content?: string | null
          utm_medium: string
          utm_source: string
          utm_term?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      vacation_balance: {
        Row: {
          available_days: number
          created_at: string
          id: string
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          available_days?: number
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          available_days?: number
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          acquisition_period_end: string | null
          acquisition_period_start: string | null
          approved_at: string | null
          approved_by: string | null
          business_days: number
          created_at: string
          end_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          sold_days: number | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acquisition_period_end?: string | null
          acquisition_period_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_days: number
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          sold_days?: number | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acquisition_period_end?: string | null
          acquisition_period_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_days?: number
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          sold_days?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_permission: {
        Args: { _feature: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_socio_or_rafael: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      approval_status: "pending" | "approved" | "rejected"
      elimination_reason:
        | "sem_interesse_candidato"
        | "sem_interesse_escritorio"
        | "reprovado_entrevista"
        | "reprovado_prova"
        | "reprovado_entrevista_presencial"
        | "outro"
      position_type:
        | "socio"
        | "advogado"
        | "estagiario"
        | "comercial"
        | "administrativo"
      recruitment_stage:
        | "curriculo_recebido"
        | "entrevista_agendada"
        | "entrevista_realizada"
        | "aguardando_prova"
        | "prova_realizada"
        | "entrevista_presencial_agendada"
        | "entrevista_presencial_realizada"
        | "contratado"
        | "eliminado"
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
      elimination_reason: [
        "sem_interesse_candidato",
        "sem_interesse_escritorio",
        "reprovado_entrevista",
        "reprovado_prova",
        "reprovado_entrevista_presencial",
        "outro",
      ],
      position_type: [
        "socio",
        "advogado",
        "estagiario",
        "comercial",
        "administrativo",
      ],
      recruitment_stage: [
        "curriculo_recebido",
        "entrevista_agendada",
        "entrevista_realizada",
        "aguardando_prova",
        "prova_realizada",
        "entrevista_presencial_agendada",
        "entrevista_presencial_realizada",
        "contratado",
        "eliminado",
      ],
    },
  },
} as const
