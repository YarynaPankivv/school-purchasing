// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт.
// Ця версія написана вручну за міграціями 20261012000000_profiles_and_roles.sql і 20261018182200_org_departments.sql;
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
      requests: {
        Row: {
          id: string;
          type: string;
          purchase_type: string | null;
          department_id: string;
          author_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          purchase_type?: string | null;
          department_id: string;
          author_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          purchase_type?: string | null;
          department_id?: string;
          author_id?: string;
          status?: string;
          created_at?: string;
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
            foreignKeyName: "requests_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
