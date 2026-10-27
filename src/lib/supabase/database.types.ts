// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт.
// Ця версія написана вручну за міграціями 20261012000000_profiles_and_roles.sql, 20261018182200_org_departments.sql
// 20261018200633_org_permissions.sql, 20261021120000_org_users.sql і 20261021140000_pur_drafts.sql;
// після зеленого db-check її можна замінити згенерованою.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      department_approvers: {
        Row: {
          department_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          department_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          department_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "department_approvers_member_fkey";
            columns: ["department_id", "user_id"];
            isOneToOne: true;
            referencedRelation: "department_members";
            referencedColumns: ["department_id", "user_id"];
          },
        ];
      };
      department_members: {
        Row: {
          department_id: string;
          user_id: string;
          auto_approve: boolean;
          created_at: string;
        };
        Insert: {
          department_id: string;
          user_id: string;
          auto_approve?: boolean;
          created_at?: string;
        };
        Update: {
          department_id?: string;
          user_id?: string;
          auto_approve?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "department_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      request_history: {
        Row: {
          id: string;
          request_id: string;
          actor_id: string;
          actor_name: string | null;
          action: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          actor_id: string;
          actor_name?: string | null;
          action: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          actor_id?: string;
          actor_name?: string | null;
          action?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      request_lines: {
        Row: {
          id: string;
          request_id: string;
          position: number;
          name: string | null;
          purpose: string | null;
          quantity: number | null;
          unit_price: number | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          position?: number;
          name?: string | null;
          purpose?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          position?: number;
          name?: string | null;
          purpose?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_lines_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      requests: {
        Row: {
          id: string;
          type: string;
          purchase_type: string | null;
          department_id: string | null;
          author_id: string;
          on_behalf_of_id: string | null;
          status: string;
          created_at: string;
          number: number | null;
          note: string | null;
          delivery_date: string | null;
          editing: boolean;
          decision_reason: string | null;
          archived_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          purchase_type?: string | null;
          department_id?: string | null;
          author_id: string;
          on_behalf_of_id?: string | null;
          status?: string;
          created_at?: string;
          number?: number | null;
          note?: string | null;
          delivery_date?: string | null;
          editing?: boolean;
          decision_reason?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          purchase_type?: string | null;
          department_id?: string | null;
          author_id?: string;
          on_behalf_of_id?: string | null;
          status?: string;
          created_at?: string;
          number?: number | null;
          note?: string | null;
          delivery_date?: string | null;
          editing?: boolean;
          decision_reason?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requests_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_on_behalf_of_id_fkey";
            columns: ["on_behalf_of_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      user_permissions: {
        Row: {
          user_id: string;
          card_expense: boolean;
          check_request: boolean;
          vendor_invoice: boolean;
          self_purchase: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          card_expense?: boolean;
          check_request?: boolean;
          vendor_invoice?: boolean;
          self_purchase?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          card_expense?: boolean;
          check_request?: boolean;
          vendor_invoice?: boolean;
          self_purchase?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_reject_purchase: {
        Args: { target_request: string; reason_text: string };
        Returns: string;
      };
      admin_set_active: {
        Args: { target_user: string; make_active: boolean };
        Returns: boolean;
      };
      admin_set_role: {
        Args: { target_user: string; make_admin: boolean };
        Returns: boolean;
      };
      cancel_purchase: {
        Args: { target_request: string };
        Returns: string;
      };
      copy_purchase: {
        Args: { target_request: string };
        Returns: string;
      };
      decide_purchase: {
        Args: {
          target_request: string;
          decision: string;
          reason_text?: string;
          rejected_line_ids?: string[];
        };
        Returns: string;
      };
      request_author_labels: {
        Args: Record<PropertyKey, never>;
        Returns: { user_id: string; label: string }[];
      };
      reopen_purchase: {
        Args: { target_request: string };
        Returns: string;
      };
      set_purchase_editing: {
        Args: { target_request: string; make_editing: boolean };
        Returns: boolean;
      };
      submit_purchase: {
        Args: { target_request: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
