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
      agent_credentials: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token?: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          student_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          student_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          media_path: string | null
          media_type: string | null
          pinned: boolean
          starts_at: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          media_path?: string | null
          media_type?: string | null
          pinned?: boolean
          starts_at?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          media_path?: string | null
          media_type?: string | null
          pinned?: boolean
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          abdomen: number | null
          arm_left: number | null
          arm_right: number | null
          assessed_at: string
          body_fat: number | null
          calf: number | null
          chest: number | null
          created_at: string
          created_by: string | null
          height: number | null
          hip: number | null
          id: string
          muscle_mass: number | null
          notes: string | null
          student_id: string
          thigh_left: number | null
          thigh_right: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          abdomen?: number | null
          arm_left?: number | null
          arm_right?: number | null
          assessed_at?: string
          body_fat?: number | null
          calf?: number | null
          chest?: number | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          hip?: number | null
          id?: string
          muscle_mass?: number | null
          notes?: string | null
          student_id: string
          thigh_left?: number | null
          thigh_right?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          abdomen?: number | null
          arm_left?: number | null
          arm_right?: number | null
          assessed_at?: string
          body_fat?: number | null
          calf?: number | null
          chest?: number | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          hip?: number | null
          id?: string
          muscle_mass?: number | null
          notes?: string | null
          student_id?: string
          thigh_left?: number | null
          thigh_right?: number | null
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          allowed: boolean
          credential: string | null
          direction: string
          id: string
          occurred_at: string
          reason: string | null
          source: string
          student_id: string | null
        }
        Insert: {
          allowed?: boolean
          credential?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          reason?: string | null
          source?: string
          student_id?: string | null
        }
        Update: {
          allowed?: boolean
          credential?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          reason?: string | null
          source?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          method: string
          session_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          method?: string
          session_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          method?: string
          session_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_amount: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
        }
        Relationships: []
      }
      class_students: {
        Row: {
          class_id: string
          student_id: string
        }
        Insert: {
          class_id: string
          student_id: string
        }
        Update: {
          class_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          end_time: string
          id: string
          instructor_id: string | null
          modality: string
          name: string
          start_time: string
          weekdays: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          modality?: string
          name: string
          start_time?: string
          weekdays?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          modality?: string
          name?: string
          start_time?: string
          weekdays?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_permissions: {
        Row: {
          module: string
          user_id: string
        }
        Insert: {
          module: string
          user_id: string
        }
        Update: {
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          created_at: string
          end_date: string
          id: string
          modality: string
          plan_id: string | null
          plan_name: string
          price: number
          start_date: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          modality?: string
          plan_id?: string | null
          plan_name?: string
          price?: number
          start_date?: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          modality?: string
          plan_id?: string | null
          plan_name?: string
          price?: number
          start_date?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          supplier: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          supplier?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          supplier?: string | null
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          created_at: string
          file_path: string
          id: string
          note: string | null
          receivable_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          note?: string | null
          receivable_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          note?: string | null
          receivable_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          modality: string
          months: number
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          modality?: string
          months?: number
          name: string
          price?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          modality?: string
          months?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string
          cost: number
          created_at: string
          id: string
          min_stock: number
          name: string
          price: number
          stock: number
        }
        Insert: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          price?: number
          stock?: number
        }
        Update: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          price?: number
          stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          cargo: string
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          active?: boolean
          cargo?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          active?: boolean
          cargo?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          enrollment_id: string | null
          id: string
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          student_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          enrollment_id?: string | null
          id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          student_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          enrollment_id?: string | null
          id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payment_method: string
          student_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_method?: string
          student_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_method?: string
          student_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string
          agent_last_seen: string | null
          allow_card: boolean
          allow_face: boolean
          allow_matricula: boolean
          allow_password: boolean
          allow_qrcode: boolean
          allow_sko12: boolean
          bill_alert_days: number
          block_inactive: boolean
          dashboard_mascot_url: string | null
          fingerprint_rule: string
          gym_name: string
          id: number
          keypad_rule: string
          local_agent_url: string
          phone: string
          pix_key: string
          release_seconds: number
          system_url: string
          tolerance_days: number
          turnstile_firmware: string
          turnstile_ip: string
          turnstile_model: string
          turnstile_port: number
          updated_at: string
          welcome_message: string
        }
        Insert: {
          address?: string
          agent_last_seen?: string | null
          allow_card?: boolean
          allow_face?: boolean
          allow_matricula?: boolean
          allow_password?: boolean
          allow_qrcode?: boolean
          allow_sko12?: boolean
          bill_alert_days?: number
          block_inactive?: boolean
          dashboard_mascot_url?: string | null
          fingerprint_rule?: string
          gym_name?: string
          id?: number
          keypad_rule?: string
          local_agent_url?: string
          phone?: string
          pix_key?: string
          release_seconds?: number
          system_url?: string
          tolerance_days?: number
          turnstile_firmware?: string
          turnstile_ip?: string
          turnstile_model?: string
          turnstile_port?: number
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          address?: string
          agent_last_seen?: string | null
          allow_card?: boolean
          allow_face?: boolean
          allow_matricula?: boolean
          allow_password?: boolean
          allow_qrcode?: boolean
          allow_sko12?: boolean
          bill_alert_days?: number
          block_inactive?: boolean
          dashboard_mascot_url?: string | null
          fingerprint_rule?: string
          gym_name?: string
          id?: number
          keypad_rule?: string
          local_agent_url?: string
          phone?: string
          pix_key?: string
          release_seconds?: number
          system_url?: string
          tolerance_days?: number
          turnstile_firmware?: string
          turnstile_ip?: string
          turnstile_model?: string
          turnstile_port?: number
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      student_accounts: {
        Row: {
          created_at: string
          email_verified_at: string | null
          phone_verified_at: string | null
          student_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_verified_at?: string | null
          phone_verified_at?: string | null
          student_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_verified_at?: string | null
          phone_verified_at?: string | null
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_activation_codes: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          student_id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          student_id: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          student_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_activation_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_activation_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_auth_attempts: {
        Row: {
          created_at: string
          id: string
          key: string
          kind: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          kind: string
          success?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          kind?: string
          success?: boolean
        }
        Relationships: []
      }
      student_face_templates: {
        Row: {
          consent_at: string
          consent_text_version: string
          created_at: string
          descriptor: Json
          recorded_by: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          consent_at: string
          consent_text_version: string
          created_at?: string
          descriptor: Json
          recorded_by?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          consent_at?: string
          consent_text_version?: string
          created_at?: string
          descriptor?: Json
          recorded_by?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_face_templates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_face_templates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_goals: {
        Row: {
          note: string | null
          student_id: string
          target_weight: number | null
          updated_at: string
          weekly_sessions: number | null
        }
        Insert: {
          note?: string | null
          student_id: string
          target_weight?: number | null
          updated_at?: string
          weekly_sessions?: number | null
        }
        Update: {
          note?: string | null
          student_id?: string
          target_weight?: number | null
          updated_at?: string
          weekly_sessions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_qr_secrets: {
        Row: {
          created_at: string
          secret: string
          student_id: string
        }
        Insert: {
          created_at?: string
          secret: string
          student_id: string
        }
        Update: {
          created_at?: string
          secret?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_training_state: {
        Row: {
          next_letter: string
          student_id: string
          updated_at: string
        }
        Insert: {
          next_letter: string
          student_id: string
          updated_at?: string
        }
        Update: {
          next_letter?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_training_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_training_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          access_password: string | null
          address: string | null
          birth_date: string | null
          card_number: string | null
          cpf: string | null
          created_at: string
          email: string | null
          gender: string | null
          id: string
          matricula: number
          medical_notes: string | null
          name: string
          notes: string | null
          photo_url: string | null
          qr_code: string
          status: string
          whatsapp: string | null
        }
        Insert: {
          access_password?: string | null
          address?: string | null
          birth_date?: string | null
          card_number?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          matricula?: number
          medical_notes?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          qr_code?: string
          status?: string
          whatsapp?: string | null
        }
        Update: {
          access_password?: string | null
          address?: string | null
          birth_date?: string | null
          card_number?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          matricula?: number
          medical_notes?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          qr_code?: string
          status?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      turnstile_commands: {
        Row: {
          command: string
          created_at: string
          direction: string
          executed_at: string | null
          id: string
          requested_by: string | null
        }
        Insert: {
          command?: string
          created_at?: string
          direction?: string
          executed_at?: string | null
          id?: string
          requested_by?: string | null
        }
        Update: {
          command?: string
          created_at?: string
          direction?: string
          executed_at?: string | null
          id?: string
          requested_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          exercise: string
          id: string
          load: string
          notes: string | null
          reps: string
          rest: string
          sets: string
          sort_order: number
          workout_id: string
        }
        Insert: {
          exercise: string
          id?: string
          load?: string
          notes?: string | null
          reps?: string
          rest?: string
          sets?: string
          sort_order?: number
          workout_id: string
        }
        Update: {
          exercise?: string
          id?: string
          load?: string
          notes?: string | null
          reps?: string
          rest?: string
          sets?: string
          sort_order?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          finished_at: string | null
          id: string
          letter: string
          started_at: string
          status: string
          student_id: string
          workout_id: string | null
          workout_name: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          letter: string
          started_at?: string
          status?: string
          student_id: string
          workout_id?: string | null
          workout_name?: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          letter?: string
          started_at?: string
          status?: string
          student_id?: string
          workout_id?: string | null
          workout_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_set_logs: {
        Row: {
          created_at: string
          duration_seconds: number | null
          exercise_id: string | null
          exercise_name: string
          id: string
          load: number | null
          reps: number | null
          session_id: string
          set_number: number
          skip_reason: string | null
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          exercise_id?: string | null
          exercise_name: string
          id?: string
          load?: number | null
          reps?: number | null
          session_id: string
          set_number?: number
          skip_reason?: string | null
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          exercise_id?: string | null
          exercise_name?: string
          id?: string
          load?: number | null
          reps?: number | null
          session_id?: string
          set_number?: number
          skip_reason?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          letter: string
          name: string
          notes: string | null
          student_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          letter?: string
          name?: string
          notes?: string | null
          student_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          letter?: string
          name?: string
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      student_overview: {
        Row: {
          access_password: string | null
          address: string | null
          birth_date: string | null
          card_number: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string | null
          matricula: number | null
          medical_notes: string | null
          name: string | null
          notes: string | null
          overdue_since: string | null
          photo_url: string | null
          qr_code: string | null
          status: string | null
          valid_until: string | null
          whatsapp: string | null
        }
        Insert: {
          access_password?: string | null
          address?: string | null
          birth_date?: string | null
          card_number?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string | null
          matricula?: number | null
          medical_notes?: string | null
          name?: string | null
          notes?: string | null
          overdue_since?: never
          photo_url?: string | null
          qr_code?: string | null
          status?: string | null
          valid_until?: never
          whatsapp?: string | null
        }
        Update: {
          access_password?: string | null
          address?: string | null
          birth_date?: string | null
          card_number?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string | null
          matricula?: number | null
          medical_notes?: string | null
          name?: string | null
          notes?: string | null
          overdue_since?: never
          photo_url?: string | null
          qr_code?: string | null
          status?: string | null
          valid_until?: never
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aluno_cancel_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      aluno_finish_session: { Args: { _session_id: string }; Returns: string }
      aluno_me: {
        Args: never
        Returns: {
          id: string
          matricula: number
          name: string
          overdue_since: string
          photo_url: string
          status: string
          valid_until: string
        }[]
      }
      aluno_pix: {
        Args: never
        Returns: {
          gym_name: string
          phone: string
          pix_key: string
          tolerance_days: number
        }[]
      }
      aluno_start_session: { Args: { _workout_id: string }; Returns: string }
      review_student_payment_proof: { Args: { _proof_id: string; _approved: boolean; _note?: string | null }; Returns: undefined }
      can_access: { Args: { _module: string }; Returns: boolean }
      current_student_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      login_staff_list: {
        Args: never
        Returns: {
          cargo: string
          full_name: string
          id: string
        }[]
      }
      setup_needed: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
