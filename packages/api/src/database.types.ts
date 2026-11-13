
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "categories": {
                  Row: {
                    "id": number,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: never,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "id": number,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "id"?: never,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"equipment": {
                  Row: {
                    "asset_tag": string,"department_id": number | null,"id": number,"install_location": string | null,"name": string,"serial_no": string | null,"status": Database["public"]['Enums']["equipment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_tag": string,"department_id"?: number | null,"id"?: never,"install_location"?: string | null,"name": string,"serial_no"?: string | null,"status"?: Database["public"]['Enums']["equipment_status"]
                  }
                  Update: {
                    "asset_tag"?: string,"department_id"?: number | null,"id"?: never,"install_location"?: string | null,"name"?: string,"serial_no"?: string | null,"status"?: Database["public"]['Enums']["equipment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"department_id": number | null,"display_name": string,"expo_push_token": string | null,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: number | null,"display_name": string,"expo_push_token"?: string | null,"id": string,"is_active"?: boolean,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: number | null,"display_name"?: string,"expo_push_token"?: string | null,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"status_transitions": {
                  Row: {
                    "from_status": Database["public"]['Enums']["ticket_status"],"role": Database["public"]['Enums']["app_role"],"to_status": Database["public"]['Enums']["ticket_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "from_status": Database["public"]['Enums']["ticket_status"],"role": Database["public"]['Enums']["app_role"],"to_status": Database["public"]['Enums']["ticket_status"]
                  }
                  Update: {
                    "from_status"?: Database["public"]['Enums']["ticket_status"],"role"?: Database["public"]['Enums']["app_role"],"to_status"?: Database["public"]['Enums']["ticket_status"]
                  }
                  Relationships: [
                    
                  ]
                },"ticket_attachments": {
                  Row: {
                    "created_at": string,"file_name": string,"id": number,"storage_path": string,"ticket_id": string,"uploader_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: never,"storage_path": string,"ticket_id": string,"uploader_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: never,"storage_path"?: string,"ticket_id"?: string,"uploader_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_attachments_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_attachments_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_attachments_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "technician_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_attachments_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "ticket_people"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": number,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"id"?: never,"ticket_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: never,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "technician_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "ticket_people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_comments_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_counters": {
                  Row: {
                    "last": number,"ym": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last": number,"ym": string
                  }
                  Update: {
                    "last"?: number,"ym"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ticket_events": {
                  Row: {
                    "action": Database["public"]['Enums']["ticket_event_action"],"actor_id": string | null,"created_at": string,"detail": string | null,"from_status": Database["public"]['Enums']["ticket_status"] | null,"id": number,"ticket_id": string,"to_status": Database["public"]['Enums']["ticket_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["ticket_event_action"],"actor_id"?: string | null,"created_at"?: string,"detail"?: string | null,"from_status"?: Database["public"]['Enums']["ticket_status"] | null,"id"?: never,"ticket_id": string,"to_status"?: Database["public"]['Enums']["ticket_status"] | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["ticket_event_action"],"actor_id"?: string | null,"created_at"?: string,"detail"?: string | null,"from_status"?: Database["public"]['Enums']["ticket_status"] | null,"id"?: never,"ticket_id"?: string,"to_status"?: Database["public"]['Enums']["ticket_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "technician_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "ticket_people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_events_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "assignee_id": string | null,"category_id": number,"client_request_id": string,"created_at": string,"description": string,"equipment_id": number | null,"id": string,"location": string,"priority": Database["public"]['Enums']["ticket_priority"],"reporter_id": string,"resolution": string | null,"resolved_at": string | null,"status": Database["public"]['Enums']["ticket_status"],"ticket_no": string,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"category_id": number,"client_request_id": string,"created_at"?: string,"description": string,"equipment_id"?: number | null,"id"?: string,"location": string,"priority"?: Database["public"]['Enums']["ticket_priority"],"reporter_id"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["ticket_status"],"ticket_no": string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "assignee_id"?: string | null,"category_id"?: number,"client_request_id"?: string,"created_at"?: string,"description"?: string,"equipment_id"?: number | null,"id"?: string,"location"?: string,"priority"?: Database["public"]['Enums']["ticket_priority"],"reporter_id"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["ticket_status"],"ticket_no"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "technician_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "ticket_people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "technician_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "ticket_people"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "technician_options": {
                  Row: {
                    "display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "display_name"?: string | null,"id"?: string | null
                         }
                        Update: {
                           "display_name"?: string | null,"id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"ticket_people": {
                  Row: {
                    "display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "display_name"?: string | null,"id"?: string | null
                         }
                        Update: {
                           "display_name"?: string | null,"id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "can_see_ticket":
{ Args: { "p_ticket_id": string }; Returns: boolean
                           },
"can_see_ticket_row":
{ Args: { "p_assignee_id": string,"p_reporter_id": string,"p_status": Database["public"]['Enums']["ticket_status"] }; Returns: boolean
                           },
"claim_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"generate_ticket_no":
{ Args: { "at": string }; Returns: string
                           },
"is_active_technician":
{ Args: { "p_user": string }; Returns: boolean
                           },
"is_attached_photo":
{ Args: { "p_path": string }; Returns: boolean
                           },
"reassign_ticket":
{ Args: { "p_assignee": string,"p_expected_version": number,"p_reason": string,"p_ticket_id": string }; Returns: {
              "assignee_id": string | null,
"category_id": number,
"client_request_id": string,
"created_at": string,
"description": string,
"equipment_id": number | null,
"id": string,
"location": string,
"priority": Database["public"]['Enums']["ticket_priority"],
"reporter_id": string,
"resolution": string | null,
"resolved_at": string | null,
"status": Database["public"]['Enums']["ticket_status"],
"ticket_no": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "tickets"
        isOneToOne: true
        isSetofReturn: false
      } },
"sync_equipment_status":
{ Args: { "p_equipment_id": number }; Returns: undefined
                           },
"ticket_summary":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"transition_ticket":
{ Args: { "p_assignee"?: string,"p_expected_version": number,"p_resolution"?: string,"p_ticket_id": string,"p_to": Database["public"]['Enums']["ticket_status"] }; Returns: {
              "assignee_id": string | null,
"category_id": number,
"client_request_id": string,
"created_at": string,
"description": string,
"equipment_id": number | null,
"id": string,
"location": string,
"priority": Database["public"]['Enums']["ticket_priority"],
"reporter_id": string,
"resolution": string | null,
"resolved_at": string | null,
"status": Database["public"]['Enums']["ticket_status"],
"ticket_no": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "tickets"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "app_role": "reporter"|"technician"|"admin","equipment_status": "active"|"under_repair"|"retired","ticket_event_action": "created"|"status"|"assigned"|"reassigned"|"comment","ticket_priority": "low"|"normal"|"urgent","ticket_status": "new"|"assigned"|"in_progress"|"done"|"closed"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["reporter", "technician", "admin"],"equipment_status": ["active", "under_repair", "retired"],"ticket_event_action": ["created", "status", "assigned", "reassigned", "comment"],"ticket_priority": ["low", "normal", "urgent"],"ticket_status": ["new", "assigned", "in_progress", "done", "closed", "cancelled"]
          }
        }
} as const
