// ============================================================
// PipeField OS — Supabase Database Type Mirror
// Covers all 23 tables used across the application.
//
// Generated from SQL schema files — update when migrations run.
// Next step: replace with `npx supabase gen types typescript`
// once the Supabase CLI is installed and project is linked.
// ============================================================

export type Database = {
  public: {
    Tables: {

      // ── Core ──────────────────────────────────────────────
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          subscription_tier: string
          subscription_status: string
          seat_limit: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          subscription_tier?: string
          subscription_status?: string
          seat_limit?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }

      user_profiles: {
        Row: {
          id: string
          auth_user_id: string
          organization_id: string
          full_name: string
          email: string
          role: 'platform_admin' | 'organization_owner' | 'administrator' | 'project_manager' | 'foreman' | 'qa_inspector' | 'shop_fabricator' | 'pipefitter' | 'client_viewer'
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          organization_id: string
          full_name: string
          email: string
          role?: 'platform_admin' | 'organization_owner' | 'administrator' | 'project_manager' | 'foreman' | 'qa_inspector' | 'shop_fabricator' | 'pipefitter' | 'client_viewer'
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }

      projects: {
        Row: {
          id: string
          organization_id: string
          name: string
          project_number: string | null
          description: string | null
          client_name: string | null
          location: string | null
          status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
          start_date: string | null
          end_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          project_number?: string | null
          description?: string | null
          client_name?: string | null
          location?: string | null
          status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
          start_date?: string | null
          end_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }

      spools: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          spool_number: string
          line_number: string | null
          description: string | null
          material: string | null
          size: string | null
          schedule: string | null
          heat_number: string | null
          status: 'not_started' | 'in_fabrication' | 'fab_complete' | 'nde_pending' | 'nde_complete' | 'hydro_pending' | 'hydro_complete' | 'complete' | 'installed' | 'tested' | 'rejected'
          priority: 'low' | 'normal' | 'high' | 'critical'
          required_date: string | null
          location: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          spool_number: string
          line_number?: string | null
          description?: string | null
          material?: string | null
          size?: string | null
          schedule?: string | null
          heat_number?: string | null
          status?: 'not_started' | 'in_fabrication' | 'fab_complete' | 'nde_pending' | 'nde_complete' | 'hydro_pending' | 'hydro_complete' | 'complete' | 'installed' | 'tested' | 'rejected'
          priority?: 'low' | 'normal' | 'high' | 'critical'
          required_date?: string | null
          location?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['spools']['Insert']>
      }

      spool_items: {
        Row: {
          id: string
          spool_id: string
          organization_id: string
          item_number: number
          item_type: string
          description: string
          quantity: number
          length_in: number | null
          heat_number: string | null
          is_cut: boolean
          is_fitted: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          spool_id: string
          organization_id: string
          item_number: number
          item_type?: string
          description: string
          quantity?: number
          length_in?: number | null
          heat_number?: string | null
          is_cut?: boolean
          is_fitted?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['spool_items']['Insert']>
      }

      welds: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          spool_id: string | null
          weld_id_number: string
          weld_type: string | null
          size: string | null
          schedule: string | null
          material: string | null
          process: string | null
          status: 'not_welded' | 'in_progress' | 'welded' | 'nde_pending' | 'nde_pass' | 'nde_fail' | 'rejected'
          welder_id: string | null
          welder_stamp: string | null
          welder_name: string | null
          filler_material: string | null
          heat_number: string | null
          weld_date: string | null
          visual_inspection: boolean
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          spool_id?: string | null
          weld_id_number: string
          weld_type?: string | null
          size?: string | null
          schedule?: string | null
          material?: string | null
          process?: string | null
          status?: 'not_welded' | 'in_progress' | 'welded' | 'nde_pending' | 'nde_pass' | 'nde_fail' | 'rejected'
          welder_id?: string | null
          welder_stamp?: string | null
          welder_name?: string | null
          filler_material?: string | null
          heat_number?: string | null
          weld_date?: string | null
          visual_inspection?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['welds']['Insert']>
      }

      welders: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          stamp: string
          email: string | null
          phone: string | null
          process: string[] | null
          position: string[] | null
          certification_no: string | null
          cert_expiry: string | null
          is_active: boolean
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          full_name: string
          stamp: string
          email?: string | null
          phone?: string | null
          process?: string[] | null
          position?: string[] | null
          certification_no?: string | null
          cert_expiry?: string | null
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['welders']['Insert']>
      }

      nde_inspections: {
        Row: {
          id: string
          organization_id: string
          weld_id: string
          project_id: string
          inspection_type: 'RT' | 'UT' | 'PT' | 'MT' | 'VT' | 'PMI' | 'HT'
          result: 'pending' | 'pass' | 'fail' | 'repair' | 'retest'
          inspector_name: string | null
          inspection_date: string | null
          report_number: string | null
          film_location: string | null
          acceptance_code: string | null
          defect_type: string | null
          defect_location: string | null
          repair_weld_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          weld_id: string
          project_id: string
          inspection_type: 'RT' | 'UT' | 'PT' | 'MT' | 'VT' | 'PMI' | 'HT'
          result?: 'pending' | 'pass' | 'fail' | 'repair' | 'retest'
          inspector_name?: string | null
          inspection_date?: string | null
          report_number?: string | null
          film_location?: string | null
          acceptance_code?: string | null
          defect_type?: string | null
          defect_location?: string | null
          repair_weld_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['nde_inspections']['Insert']>
      }

      documents: {
        Row: {
          id: string
          organization_id: string
          project_id: string | null
          title: string
          document_number: string | null
          document_type: 'drawing' | 'specification' | 'procedure' | 'certificate' | 'report' | 'datasheet' | 'itp' | 'correspondence' | 'submittal' | 'method_statement' | 'risk_assessment' | 'other'
          revision: string | null
          status: 'draft' | 'under_review' | 'approved' | 'superseded' | 'void'
          prepared_by: string | null
          reviewed_by: string | null
          approved_by: string | null
          issue_date: string | null
          file_url: string | null
          file_size: number | null
          mime_type: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id?: string | null
          title: string
          document_number?: string | null
          document_type?: 'drawing' | 'specification' | 'procedure' | 'certificate' | 'report' | 'datasheet' | 'itp' | 'correspondence' | 'submittal' | 'method_statement' | 'risk_assessment' | 'other'
          revision?: string | null
          status?: 'draft' | 'under_review' | 'approved' | 'superseded' | 'void'
          prepared_by?: string | null
          reviewed_by?: string | null
          approved_by?: string | null
          issue_date?: string | null
          file_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }

      rfis: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          rfi_number: string
          title: string
          discipline: 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'general'
          priority: 'low' | 'normal' | 'high' | 'urgent'
          question: string
          background: string | null
          drawing_refs: string | null
          spec_refs: string | null
          submitted_to: string | null
          submitted_date: string | null
          required_by_date: string | null
          answer: string | null
          answered_by: string | null
          answered_date: string | null
          status: 'open' | 'answered' | 'closed' | 'void'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          rfi_number: string
          title: string
          discipline?: 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'general'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          question: string
          background?: string | null
          drawing_refs?: string | null
          spec_refs?: string | null
          submitted_to?: string | null
          submitted_date?: string | null
          required_by_date?: string | null
          answer?: string | null
          answered_by?: string | null
          answered_date?: string | null
          status?: 'open' | 'answered' | 'closed' | 'void'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['rfis']['Insert']>
      }

      ncrs: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          ncr_number: string
          title: string
          discipline: 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'welding' | 'material' | 'documentation' | 'other'
          severity: 'minor' | 'major' | 'critical'
          ncr_type: 'workmanship' | 'material' | 'design' | 'documentation' | 'procedure' | 'other'
          description: string
          location: string | null
          drawing_ref: string | null
          spec_ref: string | null
          raised_by: string | null
          raised_date: string | null
          assigned_to: string | null
          disposition: 'use_as_is' | 'repair' | 'rework' | 'reject_replace' | 'pending' | null
          disposition_notes: string | null
          corrective_action: string | null
          root_cause: string | null
          status: 'open' | 'under_review' | 'disposition_pending' | 'closed' | 'void'
          closed_by: string | null
          closed_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          ncr_number: string
          title: string
          discipline?: 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'welding' | 'material' | 'documentation' | 'other'
          severity?: 'minor' | 'major' | 'critical'
          ncr_type?: 'workmanship' | 'material' | 'design' | 'documentation' | 'procedure' | 'other'
          description: string
          location?: string | null
          drawing_ref?: string | null
          spec_ref?: string | null
          raised_by?: string | null
          raised_date?: string | null
          assigned_to?: string | null
          disposition?: 'use_as_is' | 'repair' | 'rework' | 'reject_replace' | 'pending' | null
          disposition_notes?: string | null
          corrective_action?: string | null
          root_cause?: string | null
          status?: 'open' | 'under_review' | 'disposition_pending' | 'closed' | 'void'
          closed_by?: string | null
          closed_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['ncrs']['Insert']>
      }

      punch_items: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          item_number: string
          discipline: 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'insulation' | 'painting' | 'other'
          category: 'A' | 'B' | 'C'
          description: string
          location: string | null
          drawing_ref: string | null
          raised_by: string | null
          assigned_to: string | null
          due_date: string | null
          status: 'open' | 'in_progress' | 'complete' | 'accepted' | 'void'
          closed_by: string | null
          closed_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          item_number: string
          discipline?: 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'insulation' | 'painting' | 'other'
          category?: 'A' | 'B' | 'C'
          description: string
          location?: string | null
          drawing_ref?: string | null
          raised_by?: string | null
          assigned_to?: string | null
          due_date?: string | null
          status?: 'open' | 'in_progress' | 'complete' | 'accepted' | 'void'
          closed_by?: string | null
          closed_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['punch_items']['Insert']>
      }

      pressure_tests: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          test_number: string
          system_name: string
          line_numbers: string | null
          test_type: 'hydrostatic' | 'pneumatic' | 'leak' | 'service'
          test_medium: 'water' | 'air' | 'nitrogen' | 'process_fluid' | 'other'
          design_pressure: number | null
          test_pressure: number
          pressure_unit: 'kPa' | 'bar' | 'psi' | 'MPa'
          hold_time_minutes: number | null
          test_date: string | null
          witnessed_by: string | null
          result: 'pending' | 'pass' | 'fail' | 'conditional'
          status: 'scheduled' | 'in_progress' | 'complete' | 'failed' | 'void'
          failure_description: string | null
          certificate_number: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          test_number: string
          system_name: string
          line_numbers?: string | null
          test_type?: 'hydrostatic' | 'pneumatic' | 'leak' | 'service'
          test_medium?: 'water' | 'air' | 'nitrogen' | 'process_fluid' | 'other'
          design_pressure?: number | null
          test_pressure: number
          pressure_unit?: 'kPa' | 'bar' | 'psi' | 'MPa'
          hold_time_minutes?: number | null
          test_date?: string | null
          witnessed_by?: string | null
          result?: 'pending' | 'pass' | 'fail' | 'conditional'
          status?: 'scheduled' | 'in_progress' | 'complete' | 'failed' | 'void'
          failure_description?: string | null
          certificate_number?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['pressure_tests']['Insert']>
      }

      mtrs: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          heat_number: string
          mtr_number: string | null
          material_spec: string
          material_type: 'pipe' | 'fitting' | 'flange' | 'valve' | 'bolt' | 'gasket' | 'plate' | 'bar' | 'other'
          nominal_size: string | null
          schedule: string | null
          quantity: number | null
          unit: string | null
          supplier: string | null
          received_date: string | null
          status: 'pending_review' | 'accepted' | 'rejected' | 'quarantine'
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          heat_number: string
          mtr_number?: string | null
          material_spec: string
          material_type?: 'pipe' | 'fitting' | 'flange' | 'valve' | 'bolt' | 'gasket' | 'plate' | 'bar' | 'other'
          nominal_size?: string | null
          schedule?: string | null
          quantity?: number | null
          unit?: string | null
          supplier?: string | null
          received_date?: string | null
          status?: 'pending_review' | 'accepted' | 'rejected' | 'quarantine'
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['mtrs']['Insert']>
      }

      line_list: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          line_number: string
          service: string | null
          fluid_code: string | null
          pipe_class: string | null
          nominal_size: string | null
          design_pressure: number | null
          design_temp: number | null
          test_pressure: number | null
          insulation: string | null
          from_equipment: string | null
          to_equipment: string | null
          total_welds: number
          total_spools: number
          priority: 'low' | 'normal' | 'high' | 'critical'
          status: 'not_started' | 'in_progress' | 'fab_complete' | 'installed' | 'tested' | 'complete'
          target_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          line_number: string
          service?: string | null
          fluid_code?: string | null
          pipe_class?: string | null
          nominal_size?: string | null
          design_pressure?: number | null
          design_temp?: number | null
          test_pressure?: number | null
          insulation?: string | null
          from_equipment?: string | null
          to_equipment?: string | null
          total_welds?: number
          total_spools?: number
          priority?: 'low' | 'normal' | 'high' | 'critical'
          status?: 'not_started' | 'in_progress' | 'fab_complete' | 'installed' | 'tested' | 'complete'
          target_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['line_list']['Insert']>
      }

      flange_joints: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          joint_number: string
          line_number: string | null
          spool_id: string | null
          flange_type: 'weld_neck' | 'slip_on' | 'blind' | 'socket_weld' | 'lap_joint' | 'threaded' | 'orifice'
          flange_rating: string | null
          nominal_size: string | null
          gasket_type: string | null
          gasket_material: string | null
          bolt_spec: string | null
          bolt_size: string | null
          bolt_count: number | null
          nut_spec: string | null
          target_torque_nm: number | null
          torque_unit: string
          torque_passes: number
          assembled_by: string | null
          assembly_date: string | null
          torque_wrench_id: string | null
          torque_cert_date: string | null
          final_torque_nm: number | null
          inspector_name: string | null
          inspection_date: string | null
          status: 'pending' | 'assembled' | 'torqued' | 'inspected' | 'accepted' | 'rejected'
          rejection_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          joint_number: string
          line_number?: string | null
          spool_id?: string | null
          flange_type?: 'weld_neck' | 'slip_on' | 'blind' | 'socket_weld' | 'lap_joint' | 'threaded' | 'orifice'
          flange_rating?: string | null
          nominal_size?: string | null
          gasket_type?: string | null
          gasket_material?: string | null
          bolt_spec?: string | null
          bolt_size?: string | null
          bolt_count?: number | null
          nut_spec?: string | null
          target_torque_nm?: number | null
          torque_unit?: string
          torque_passes?: number
          assembled_by?: string | null
          assembly_date?: string | null
          torque_wrench_id?: string | null
          torque_cert_date?: string | null
          final_torque_nm?: number | null
          inspector_name?: string | null
          inspection_date?: string | null
          status?: 'pending' | 'assembled' | 'torqued' | 'inspected' | 'accepted' | 'rejected'
          rejection_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['flange_joints']['Insert']>
      }

      itps: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          itp_number: string
          title: string
          revision: string | null
          discipline: string
          status: 'draft' | 'issued' | 'approved' | 'superseded'
          approved_by: string | null
          approved_date: string | null
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          itp_number: string
          title: string
          revision?: string | null
          discipline?: string
          status?: 'draft' | 'issued' | 'approved' | 'superseded'
          approved_by?: string | null
          approved_date?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['itps']['Insert']>
      }

      itp_items: {
        Row: {
          id: string
          organization_id: string
          itp_id: string
          project_id: string
          item_number: string
          activity: string
          description: string | null
          reference_doc: string | null
          acceptance_criteria: string | null
          contractor_level: 'perform' | 'witness' | 'hold' | 'review' | 'na'
          client_level: 'perform' | 'witness' | 'hold' | 'review' | 'na'
          tpi_level: 'perform' | 'witness' | 'hold' | 'review' | 'na'
          status: 'pending' | 'in_progress' | 'complete' | 'na' | 'failed'
          completed_by: string | null
          completed_date: string | null
          comments: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          itp_id: string
          project_id: string
          item_number: string
          activity: string
          description?: string | null
          reference_doc?: string | null
          acceptance_criteria?: string | null
          contractor_level?: 'perform' | 'witness' | 'hold' | 'review' | 'na'
          client_level?: 'perform' | 'witness' | 'hold' | 'review' | 'na'
          tpi_level?: 'perform' | 'witness' | 'hold' | 'review' | 'na'
          status?: 'pending' | 'in_progress' | 'complete' | 'na' | 'failed'
          completed_by?: string | null
          completed_date?: string | null
          comments?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['itp_items']['Insert']>
      }

      system_turnover_packages: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          stp_number: string
          system_name: string
          system_description: string | null
          discipline: 'mechanical' | 'piping' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'hvac' | 'process' | 'all' | null
          status: 'not_started' | 'pre_comm_in_progress' | 'pre_comm_complete' | 'comm_in_progress' | 'comm_complete' | 'accepted'
          pre_comm_target_date: string | null
          comm_target_date: string | null
          handover_date: string | null
          responsible_engineer: string | null
          client_rep: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          stp_number: string
          system_name: string
          system_description?: string | null
          discipline?: 'mechanical' | 'piping' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'hvac' | 'process' | 'all' | null
          status?: 'not_started' | 'pre_comm_in_progress' | 'pre_comm_complete' | 'comm_in_progress' | 'comm_complete' | 'accepted'
          pre_comm_target_date?: string | null
          comm_target_date?: string | null
          handover_date?: string | null
          responsible_engineer?: string | null
          client_rep?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['system_turnover_packages']['Insert']>
      }

      precomm_items: {
        Row: {
          id: string
          organization_id: string
          stp_id: string
          sequence_no: number
          activity: string
          description: string | null
          discipline: string | null
          responsible_party: string | null
          status: 'pending' | 'in_progress' | 'complete' | 'na' | 'rejected'
          completed_by: string | null
          completed_date: string | null
          verified_by: string | null
          verified_date: string | null
          comments: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          stp_id: string
          sequence_no?: number
          activity: string
          description?: string | null
          discipline?: string | null
          responsible_party?: string | null
          status?: 'pending' | 'in_progress' | 'complete' | 'na' | 'rejected'
          completed_by?: string | null
          completed_date?: string | null
          verified_by?: string | null
          verified_date?: string | null
          comments?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['precomm_items']['Insert']>
      }

      handover_certificates: {
        Row: {
          id: string
          organization_id: string
          stp_id: string
          cert_number: string
          cert_type: 'mechanical_completion' | 'pre_commissioning' | 'commissioning' | 'performance_test' | 'final_acceptance'
          issued_date: string | null
          accepted_date: string | null
          contractor_rep: string | null
          client_rep: string | null
          notes: string | null
          status: 'draft' | 'issued' | 'accepted' | 'rejected'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          stp_id: string
          cert_number: string
          cert_type: 'mechanical_completion' | 'pre_commissioning' | 'commissioning' | 'performance_test' | 'final_acceptance'
          issued_date?: string | null
          accepted_date?: string | null
          contractor_rep?: string | null
          client_rep?: string | null
          notes?: string | null
          status?: 'draft' | 'issued' | 'accepted' | 'rejected'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['handover_certificates']['Insert']>
      }

      daily_field_reports: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          report_date: string
          report_number: string
          supervisor_name: string | null
          crew_size: number
          weather: 'clear' | 'cloudy' | 'rain' | 'snow' | 'wind' | 'extreme_heat' | 'fog' | null
          temperature: string | null
          work_areas: string | null
          work_completed: string
          equipment_used: string | null
          materials_used: string | null
          issues_delays: string | null
          safety_incidents: string | null
          visitors: string | null
          welds_completed: number
          spools_completed: number
          status: 'draft' | 'submitted' | 'approved' | 'void'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          report_date?: string
          report_number: string
          supervisor_name?: string | null
          crew_size?: number
          weather?: 'clear' | 'cloudy' | 'rain' | 'snow' | 'wind' | 'extreme_heat' | 'fog' | null
          temperature?: string | null
          work_areas?: string | null
          work_completed: string
          equipment_used?: string | null
          materials_used?: string | null
          issues_delays?: string | null
          safety_incidents?: string | null
          visitors?: string | null
          welds_completed?: number
          spools_completed?: number
          status?: 'draft' | 'submitted' | 'approved' | 'void'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['daily_field_reports']['Insert']>
      }

      audit_logs: {
        Row: {
          id: string
          organization_id: string
          table_name: string
          record_id: string
          action: 'INSERT' | 'UPDATE' | 'DELETE'
          previous_values: Record<string, unknown> | null
          new_values: Record<string, unknown> | null
          performed_by: string
          performed_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          table_name: string
          record_id: string
          action: 'INSERT' | 'UPDATE' | 'DELETE'
          previous_values?: Record<string, unknown> | null
          new_values?: Record<string, unknown> | null
          performed_by: string
          performed_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }

      notifications: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          type: 'weld_status_change' | 'failed_inspection' | 'spool_movement' | 'project_alert'
          title: string
          message: string
          is_read: boolean
          resource_type: string | null
          resource_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          type: 'weld_status_change' | 'failed_inspection' | 'spool_movement' | 'project_alert'
          title: string
          message: string
          is_read?: boolean
          resource_type?: string | null
          resource_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }

    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
