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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      anuncio_reads: {
        Row: {
          anuncio_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          anuncio_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          anuncio_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncio_reads_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncio_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anuncios: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          priority: string
          target_type: string
          target_user_ids: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          priority?: string
          target_type?: string
          target_user_ids?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          priority?: string
          target_type?: string
          target_user_ids?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          key_salt: string
          last_used_at: string | null
          name: string
          permissions: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          key_salt: string
          last_used_at?: string | null
          name: string
          permissions?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          key_salt?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      base_kibah: {
        Row: {
          "% Comisión": string | null
          Alcaldia: string | null
          Amenidades: string | null
          Bodega: string | null
          Colonia: string | null
          created_at: string
          "Desarrollador/Propietario (Whats grupo)": string | null
          Dirección: string | null
          Disponibilidad: string | null
          "Entrega Inmediata/Preventa": string | null
          "Fecha de Actualización": string | null
          "Fecha de Construcción/Entrega": string | null
          id: number
          id_propiedad: string | null
          "Link Drive": string | null
          lote_carga: string | null
          "Lugares de estacionamiento": string | null
          "M2 Exteriores": string | null
          "M2 Habitables": string | null
          "M2 Roof Garden/Jardín": string | null
          "M2 Totales": string | null
          "Nombre Desarrollador": string | null
          "Nombre Kibah": string | null
          "Número de baños": string | null
          "Número de recámaras": string | null
          "Precio por unidad": string | null
          "Tipo de Entrega": string | null
          Unidad: string | null
        }
        Insert: {
          "% Comisión"?: string | null
          Alcaldia?: string | null
          Amenidades?: string | null
          Bodega?: string | null
          Colonia?: string | null
          created_at?: string
          "Desarrollador/Propietario (Whats grupo)"?: string | null
          Dirección?: string | null
          Disponibilidad?: string | null
          "Entrega Inmediata/Preventa"?: string | null
          "Fecha de Actualización"?: string | null
          "Fecha de Construcción/Entrega"?: string | null
          id?: number
          id_propiedad?: string | null
          "Link Drive"?: string | null
          lote_carga?: string | null
          "Lugares de estacionamiento"?: string | null
          "M2 Exteriores"?: string | null
          "M2 Habitables"?: string | null
          "M2 Roof Garden/Jardín"?: string | null
          "M2 Totales"?: string | null
          "Nombre Desarrollador"?: string | null
          "Nombre Kibah"?: string | null
          "Número de baños"?: string | null
          "Número de recámaras"?: string | null
          "Precio por unidad"?: string | null
          "Tipo de Entrega"?: string | null
          Unidad?: string | null
        }
        Update: {
          "% Comisión"?: string | null
          Alcaldia?: string | null
          Amenidades?: string | null
          Bodega?: string | null
          Colonia?: string | null
          created_at?: string
          "Desarrollador/Propietario (Whats grupo)"?: string | null
          Dirección?: string | null
          Disponibilidad?: string | null
          "Entrega Inmediata/Preventa"?: string | null
          "Fecha de Actualización"?: string | null
          "Fecha de Construcción/Entrega"?: string | null
          id?: number
          id_propiedad?: string | null
          "Link Drive"?: string | null
          lote_carga?: string | null
          "Lugares de estacionamiento"?: string | null
          "M2 Exteriores"?: string | null
          "M2 Habitables"?: string | null
          "M2 Roof Garden/Jardín"?: string | null
          "M2 Totales"?: string | null
          "Nombre Desarrollador"?: string | null
          "Nombre Kibah"?: string | null
          "Número de baños"?: string | null
          "Número de recámaras"?: string | null
          "Precio por unidad"?: string | null
          "Tipo de Entrega"?: string | null
          Unidad?: string | null
        }
        Relationships: []
      }
      column_visibility: {
        Row: {
          column_name: string
          display_label: string | null
          display_order: number | null
          filter_type: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
          visible_to_asesores: boolean | null
        }
        Insert: {
          column_name: string
          display_label?: string | null
          display_order?: number | null
          filter_type?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          visible_to_asesores?: boolean | null
        }
        Update: {
          column_name?: string
          display_label?: string | null
          display_order?: number | null
          filter_type?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          visible_to_asesores?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "column_visibility_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          request_type: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          request_type: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          request_type?: string
          status?: string | null
        }
        Relationships: []
      }
      designs: {
        Row: {
          additional_notes: string | null
          complementary_stones: string | null
          created_at: string | null
          design_style: string
          emerald_type: string
          engraving: boolean | null
          id: string
          image_persisted: boolean | null
          image_url: string | null
          jewelry_type: string
          metal: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          complementary_stones?: string | null
          created_at?: string | null
          design_style: string
          emerald_type: string
          engraving?: boolean | null
          id?: string
          image_persisted?: boolean | null
          image_url?: string | null
          jewelry_type: string
          metal: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          complementary_stones?: string | null
          created_at?: string | null
          design_style?: string
          emerald_type?: string
          engraving?: boolean | null
          id?: string
          image_persisted?: boolean | null
          image_url?: string | null
          jewelry_type?: string
          metal?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          calendar_email: string | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          refresh_token: string
          selected_calendar_id: string | null
          selected_calendar_name: string | null
          token_expiry: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_email?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          refresh_token: string
          selected_calendar_id?: string | null
          selected_calendar_name?: string | null
          token_expiry: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_email?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          refresh_token?: string
          selected_calendar_id?: string | null
          selected_calendar_name?: string | null
          token_expiry?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      "La Montaña - Registro_Terapeuta": {
        Row: {
          Apellido_materno: string | null
          Apellido_paterno: string | null
          Cédula_profesional_formación: string | null
          Cédula_profesional_maestría: string | null
          Celular: string | null
          Ciudad: string | null
          costos_mínimos_por_tipo_atención: string | null
          created_at: string
          Dirección_del_consultorio: string | null
          Email: string | null
          Enfoque_terapéutico: string | null
          Escuela_procedencia_formación: string | null
          Escuela_procedencia_maestría: string | null
          Fecha_de_nacimiento: string | null
          Fecha_ingreso: string | null
          Formación: string | null
          Género: string | null
          id: number
          Idiomas_terapeuta: string | null
          Maestría: string | null
          Modalidad: string | null
          Nombre: string | null
          País: string | null
          "Paquete / tradicional": string | null
          Población_que_atiende: string | null
          Población_que_no_atiende: string | null
          Semblanza: string | null
        }
        Insert: {
          Apellido_materno?: string | null
          Apellido_paterno?: string | null
          Cédula_profesional_formación?: string | null
          Cédula_profesional_maestría?: string | null
          Celular?: string | null
          Ciudad?: string | null
          costos_mínimos_por_tipo_atención?: string | null
          created_at?: string
          Dirección_del_consultorio?: string | null
          Email?: string | null
          Enfoque_terapéutico?: string | null
          Escuela_procedencia_formación?: string | null
          Escuela_procedencia_maestría?: string | null
          Fecha_de_nacimiento?: string | null
          Fecha_ingreso?: string | null
          Formación?: string | null
          Género?: string | null
          id?: number
          Idiomas_terapeuta?: string | null
          Maestría?: string | null
          Modalidad?: string | null
          Nombre?: string | null
          País?: string | null
          "Paquete / tradicional"?: string | null
          Población_que_atiende?: string | null
          Población_que_no_atiende?: string | null
          Semblanza?: string | null
        }
        Update: {
          Apellido_materno?: string | null
          Apellido_paterno?: string | null
          Cédula_profesional_formación?: string | null
          Cédula_profesional_maestría?: string | null
          Celular?: string | null
          Ciudad?: string | null
          costos_mínimos_por_tipo_atención?: string | null
          created_at?: string
          Dirección_del_consultorio?: string | null
          Email?: string | null
          Enfoque_terapéutico?: string | null
          Escuela_procedencia_formación?: string | null
          Escuela_procedencia_maestría?: string | null
          Fecha_de_nacimiento?: string | null
          Fecha_ingreso?: string | null
          Formación?: string | null
          Género?: string | null
          id?: number
          Idiomas_terapeuta?: string | null
          Maestría?: string | null
          Modalidad?: string | null
          Nombre?: string | null
          País?: string | null
          "Paquete / tradicional"?: string | null
          Población_que_atiende?: string | null
          Población_que_no_atiende?: string | null
          Semblanza?: string | null
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      pagina_web_kibah: {
        Row: {
          "% Comisión": string | null
          Alcaldia: string | null
          Amenidades: string | null
          "Baños Max": number | null
          "Baños Min": number | null
          Bodega: string | null
          Colonia: string | null
          created_at: string
          "Desarrollador/Propietario (Whats grupo)": string | null
          "Descripción Desarrollo": string | null
          Dirección: string | null
          "Dirección BDD": string | null
          Disponibilidad: string | null
          "Entrega Inmediata/Preventa": string | null
          "Estacionamientos Max": number | null
          "Estacionamientos Min": number | null
          "Fecha de Actualización": string | null
          "Fecha de Construcción/Entrega": string | null
          id: number
          id_propiedad: string | null
          "Imagen 1": string | null
          "Imagen 2": string | null
          "Imagen 3": string | null
          "Link Imagen": string | null
          "Link Maps": string | null
          lote_carga: string | null
          "M2 Totales Max": number | null
          "M2 Totales Min": number | null
          "Nombre Desarrollador": string | null
          "Nombre Kibah": string | null
          "Precio Max": number | null
          "Precio Min": number | null
          "Recámaras Max": number | null
          "Recámaras Min": number | null
          "Tipo de Entrega": string | null
        }
        Insert: {
          "% Comisión"?: string | null
          Alcaldia?: string | null
          Amenidades?: string | null
          "Baños Max"?: number | null
          "Baños Min"?: number | null
          Bodega?: string | null
          Colonia?: string | null
          created_at?: string
          "Desarrollador/Propietario (Whats grupo)"?: string | null
          "Descripción Desarrollo"?: string | null
          Dirección?: string | null
          "Dirección BDD"?: string | null
          Disponibilidad?: string | null
          "Entrega Inmediata/Preventa"?: string | null
          "Estacionamientos Max"?: number | null
          "Estacionamientos Min"?: number | null
          "Fecha de Actualización"?: string | null
          "Fecha de Construcción/Entrega"?: string | null
          id?: number
          id_propiedad?: string | null
          "Imagen 1"?: string | null
          "Imagen 2"?: string | null
          "Imagen 3"?: string | null
          "Link Imagen"?: string | null
          "Link Maps"?: string | null
          lote_carga?: string | null
          "M2 Totales Max"?: number | null
          "M2 Totales Min"?: number | null
          "Nombre Desarrollador"?: string | null
          "Nombre Kibah"?: string | null
          "Precio Max"?: number | null
          "Precio Min"?: number | null
          "Recámaras Max"?: number | null
          "Recámaras Min"?: number | null
          "Tipo de Entrega"?: string | null
        }
        Update: {
          "% Comisión"?: string | null
          Alcaldia?: string | null
          Amenidades?: string | null
          "Baños Max"?: number | null
          "Baños Min"?: number | null
          Bodega?: string | null
          Colonia?: string | null
          created_at?: string
          "Desarrollador/Propietario (Whats grupo)"?: string | null
          "Descripción Desarrollo"?: string | null
          Dirección?: string | null
          "Dirección BDD"?: string | null
          Disponibilidad?: string | null
          "Entrega Inmediata/Preventa"?: string | null
          "Estacionamientos Max"?: number | null
          "Estacionamientos Min"?: number | null
          "Fecha de Actualización"?: string | null
          "Fecha de Construcción/Entrega"?: string | null
          id?: number
          id_propiedad?: string | null
          "Imagen 1"?: string | null
          "Imagen 2"?: string | null
          "Imagen 3"?: string | null
          "Link Imagen"?: string | null
          "Link Maps"?: string | null
          lote_carga?: string | null
          "M2 Totales Max"?: number | null
          "M2 Totales Min"?: number | null
          "Nombre Desarrollador"?: string | null
          "Nombre Kibah"?: string | null
          "Precio Max"?: number | null
          "Precio Min"?: number | null
          "Recámaras Max"?: number | null
          "Recámaras Min"?: number | null
          "Tipo de Entrega"?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          role: string
          theme_preference: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          role?: string
          theme_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string
          theme_preference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      QSS_Historial: {
        Row: {
          Comments: string | null
          Created: string | null
          Description: string | null
          Id: number
          Port: string | null
          Price: number | null
          Quantity: string | null
          UOM: string | null
        }
        Insert: {
          Comments?: string | null
          Created?: string | null
          Description?: string | null
          Id?: number
          Port?: string | null
          Price?: number | null
          Quantity?: string | null
          UOM?: string | null
        }
        Update: {
          Comments?: string | null
          Created?: string | null
          Description?: string | null
          Id?: number
          Port?: string | null
          Price?: number | null
          Quantity?: string | null
          UOM?: string | null
        }
        Relationships: []
      }
      "QSS-Price_List": {
        Row: {
          _id: string | null
          ACTUAL_STOCK: string | null
          CATEGORY: string | null
          created_at: string
          CURRENCY: string | null
          DESCRIPTION: string | null
          EXP_DATE: string | null
          EXPIRATION_DAYS: string | null
          id: number
          INVENTARIO_MAX: string | null
          INVENTARIO_MIN: string | null
          Modified: string | null
          "Modified by": string | null
          OBS_CLIENT: string | null
          OBS_QSS: string | null
          PORT: string | null
          QSS_PRESENTATION: string | null
          QSS_VARIANTS: string | null
          QTY_ORDER: string | null
          SAT: string | null
          SKU: string | null
          SPANISH: string | null
          STOCK: string | null
          STOCK_STATUS: string | null
          SUPPLIER: string | null
          template_id: number | null
          UNIT_COST: string | null
          UOM: string | null
        }
        Insert: {
          _id?: string | null
          ACTUAL_STOCK?: string | null
          CATEGORY?: string | null
          created_at?: string
          CURRENCY?: string | null
          DESCRIPTION?: string | null
          EXP_DATE?: string | null
          EXPIRATION_DAYS?: string | null
          id?: number
          INVENTARIO_MAX?: string | null
          INVENTARIO_MIN?: string | null
          Modified?: string | null
          "Modified by"?: string | null
          OBS_CLIENT?: string | null
          OBS_QSS?: string | null
          PORT?: string | null
          QSS_PRESENTATION?: string | null
          QSS_VARIANTS?: string | null
          QTY_ORDER?: string | null
          SAT?: string | null
          SKU?: string | null
          SPANISH?: string | null
          STOCK?: string | null
          STOCK_STATUS?: string | null
          SUPPLIER?: string | null
          template_id?: number | null
          UNIT_COST?: string | null
          UOM?: string | null
        }
        Update: {
          _id?: string | null
          ACTUAL_STOCK?: string | null
          CATEGORY?: string | null
          created_at?: string
          CURRENCY?: string | null
          DESCRIPTION?: string | null
          EXP_DATE?: string | null
          EXPIRATION_DAYS?: string | null
          id?: number
          INVENTARIO_MAX?: string | null
          INVENTARIO_MIN?: string | null
          Modified?: string | null
          "Modified by"?: string | null
          OBS_CLIENT?: string | null
          OBS_QSS?: string | null
          PORT?: string | null
          QSS_PRESENTATION?: string | null
          QSS_VARIANTS?: string | null
          QTY_ORDER?: string | null
          SAT?: string | null
          SKU?: string | null
          SPANISH?: string | null
          STOCK?: string | null
          STOCK_STATUS?: string | null
          SUPPLIER?: string | null
          template_id?: number | null
          UNIT_COST?: string | null
          UOM?: string | null
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          advisor_notes: string | null
          contact_preference: string | null
          created_at: string | null
          design_id: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          advisor_notes?: string | null
          contact_preference?: string | null
          created_at?: string | null
          design_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          advisor_notes?: string | null
          contact_preference?: string | null
          created_at?: string | null
          design_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          name: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      "Telegram - Noveporta": {
        Row: {
          created_at: string
          data: string | null
          id: number
        }
        Insert: {
          created_at?: string
          data?: string | null
          id?: number
        }
        Update: {
          created_at?: string
          data?: string | null
          id?: number
        }
        Relationships: []
      }
      triage_findmed: {
        Row: {
          accion_operativa: string | null
          created_at: string | null
          especialidad: string
          especialidad_normalizada: string | null
          frase_colloquial: string
          id: number
          keywords: string[] | null
          posible_padecimiento: string
          primera_parada: string
          semaforo: string
          si_esto_aparece_subir_a_urgencias: string | null
          updated_at: string | null
        }
        Insert: {
          accion_operativa?: string | null
          created_at?: string | null
          especialidad: string
          especialidad_normalizada?: string | null
          frase_colloquial: string
          id?: number
          keywords?: string[] | null
          posible_padecimiento: string
          primera_parada: string
          semaforo: string
          si_esto_aparece_subir_a_urgencias?: string | null
          updated_at?: string | null
        }
        Update: {
          accion_operativa?: string | null
          created_at?: string | null
          especialidad?: string
          especialidad_normalizada?: string | null
          frase_colloquial?: string
          id?: number
          keywords?: string[] | null
          posible_padecimiento?: string
          primera_parada?: string
          semaforo?: string
          si_esto_aparece_subir_a_urgencias?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          generation_count_today: number | null
          id: string
          last_generation_date: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          generation_count_today?: number | null
          id: string
          last_generation_date?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          generation_count_today?: number | null
          id?: string
          last_generation_date?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_allowed_users: {
        Row: {
          added_at: string | null
          added_by: string | null
          email: string
          notes: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          email: string
          notes?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          email?: string
          notes?: string | null
        }
        Relationships: []
      }
      vw_configs: {
        Row: {
          client_name: string | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          handler_slug: string | null
          id: string
          name: string
          slug: string
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          client_name?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          handler_slug?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          client_name?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          handler_slug?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          error_stack: string | null
          headers: Json | null
          id: number
          idempotency_key: string | null
          payload: Json
          payload_size_bytes: number | null
          received_at: string | null
          result_summary: Json | null
          source_ip: string | null
          started_at: string | null
          status: string
          steps: Json | null
          user_agent: string | null
          webhook_config_id: string | null
          webhook_slug: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          error_stack?: string | null
          headers?: Json | null
          id?: number
          idempotency_key?: string | null
          payload: Json
          payload_size_bytes?: number | null
          received_at?: string | null
          result_summary?: Json | null
          source_ip?: string | null
          started_at?: string | null
          status?: string
          steps?: Json | null
          user_agent?: string | null
          webhook_config_id?: string | null
          webhook_slug: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          error_stack?: string | null
          headers?: Json | null
          id?: number
          idempotency_key?: string | null
          payload?: Json
          payload_size_bytes?: number | null
          received_at?: string | null
          result_summary?: Json | null
          source_ip?: string | null
          started_at?: string | null
          status?: string
          steps?: Json | null
          user_agent?: string | null
          webhook_config_id?: string | null
          webhook_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "vw_executions_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "vw_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_genco_company_mapping: {
        Row: {
          bank_journal_id: number
          card_journal_id: number
          cash_journal_id: number
          company_id: number
          created_at: string | null
          fallback_product_id: number
          id_empresa: string
          is_active: boolean | null
          notes: string | null
          partner_id: number
          sale_journal_id: number
          tax_iva_0_id: number
          tax_iva_16_id: number
          updated_at: string | null
          vales_journal_id: number | null
        }
        Insert: {
          bank_journal_id: number
          card_journal_id: number
          cash_journal_id: number
          company_id: number
          created_at?: string | null
          fallback_product_id: number
          id_empresa: string
          is_active?: boolean | null
          notes?: string | null
          partner_id: number
          sale_journal_id: number
          tax_iva_0_id: number
          tax_iva_16_id: number
          updated_at?: string | null
          vales_journal_id?: number | null
        }
        Update: {
          bank_journal_id?: number
          card_journal_id?: number
          cash_journal_id?: number
          company_id?: number
          created_at?: string | null
          fallback_product_id?: number
          id_empresa?: string
          is_active?: boolean | null
          notes?: string | null
          partner_id?: number
          sale_journal_id?: number
          tax_iva_0_id?: number
          tax_iva_16_id?: number
          updated_at?: string | null
          vales_journal_id?: number | null
        }
        Relationships: []
      }
      vw_genco_payment_method_map: {
        Row: {
          forma_pago: string
          journal_field: string
          notes: string | null
        }
        Insert: {
          forma_pago: string
          journal_field: string
          notes?: string | null
        }
        Update: {
          forma_pago?: string
          journal_field?: string
          notes?: string | null
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string | null
          created_by: string | null
          events: string[]
          headers: Json | null
          id: string
          is_active: boolean | null
          last_status_code: number | null
          last_triggered_at: string | null
          name: string
          secret: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      desarrollos_view: {
        Row: {
          alcaldia: string | null
          amenidades: string | null
          banos_max: number | null
          banos_min: number | null
          bodega: string | null
          colonia: string | null
          contacto_desarrollador: string | null
          created_at: string | null
          descripcion: string | null
          direccion: string | null
          direccion_bdd: string | null
          disponibilidad: string | null
          estacionamientos_max: number | null
          estacionamientos_min: number | null
          fecha_actualizacion: string | null
          fecha_entrega: string | null
          id: number | null
          id_propiedad: string | null
          imagen_1: string | null
          imagen_2: string | null
          imagen_3: string | null
          imagen_principal: string | null
          link_maps: string | null
          m2_totales_max: number | null
          m2_totales_min: number | null
          nombre_desarrollador: string | null
          nombre_kibah: string | null
          pct_comision: number | null
          precio_max: number | null
          precio_min: number | null
          recamaras_max: number | null
          recamaras_min: number | null
          tipo_entrega: string | null
          tipo_preventa: string | null
        }
        Insert: {
          alcaldia?: never
          amenidades?: string | null
          banos_max?: number | null
          banos_min?: number | null
          bodega?: string | null
          colonia?: string | null
          contacto_desarrollador?: string | null
          created_at?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_bdd?: string | null
          disponibilidad?: string | null
          estacionamientos_max?: number | null
          estacionamientos_min?: number | null
          fecha_actualizacion?: string | null
          fecha_entrega?: string | null
          id?: number | null
          id_propiedad?: string | null
          imagen_1?: never
          imagen_2?: never
          imagen_3?: never
          imagen_principal?: never
          link_maps?: string | null
          m2_totales_max?: number | null
          m2_totales_min?: number | null
          nombre_desarrollador?: string | null
          nombre_kibah?: string | null
          pct_comision?: never
          precio_max?: number | null
          precio_min?: number | null
          recamaras_max?: number | null
          recamaras_min?: number | null
          tipo_entrega?: string | null
          tipo_preventa?: never
        }
        Update: {
          alcaldia?: never
          amenidades?: string | null
          banos_max?: number | null
          banos_min?: number | null
          bodega?: string | null
          colonia?: string | null
          contacto_desarrollador?: string | null
          created_at?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_bdd?: string | null
          disponibilidad?: string | null
          estacionamientos_max?: number | null
          estacionamientos_min?: number | null
          fecha_actualizacion?: string | null
          fecha_entrega?: string | null
          id?: number | null
          id_propiedad?: string | null
          imagen_1?: never
          imagen_2?: never
          imagen_3?: never
          imagen_principal?: never
          link_maps?: string | null
          m2_totales_max?: number | null
          m2_totales_min?: number | null
          nombre_desarrollador?: string | null
          nombre_kibah?: string | null
          pct_comision?: never
          precio_max?: number | null
          precio_min?: number | null
          recamaras_max?: number | null
          recamaras_min?: number | null
          tipo_entrega?: string | null
          tipo_preventa?: never
        }
        Relationships: []
      }
      propiedades_view: {
        Row: {
          alcaldia: string | null
          amenidades: string | null
          bodega: string | null
          colonia: string | null
          contacto_desarrollador: string | null
          created_at: string | null
          direccion: string | null
          disponibilidad: string | null
          estacionamiento: number | null
          fecha_actualizacion: string | null
          fecha_entrega: string | null
          id: number | null
          id_propiedad: string | null
          link_drive: string | null
          m2_exteriores: number | null
          m2_habitables: number | null
          m2_roof_garden: number | null
          m2_totales: number | null
          nombre_desarrollador: string | null
          nombre_kibah: string | null
          num_banos: number | null
          num_recamaras: number | null
          pct_comision: number | null
          precio_unidad: number | null
          tipo_entrega: string | null
          tipo_preventa: string | null
          unidad: string | null
        }
        Insert: {
          alcaldia?: never
          amenidades?: string | null
          bodega?: string | null
          colonia?: string | null
          contacto_desarrollador?: string | null
          created_at?: string | null
          direccion?: string | null
          disponibilidad?: string | null
          estacionamiento?: never
          fecha_actualizacion?: string | null
          fecha_entrega?: string | null
          id?: number | null
          id_propiedad?: string | null
          link_drive?: string | null
          m2_exteriores?: never
          m2_habitables?: never
          m2_roof_garden?: never
          m2_totales?: never
          nombre_desarrollador?: string | null
          nombre_kibah?: string | null
          num_banos?: never
          num_recamaras?: never
          pct_comision?: never
          precio_unidad?: never
          tipo_entrega?: string | null
          tipo_preventa?: never
          unidad?: string | null
        }
        Update: {
          alcaldia?: never
          amenidades?: string | null
          bodega?: string | null
          colonia?: string | null
          contacto_desarrollador?: string | null
          created_at?: string | null
          direccion?: string | null
          disponibilidad?: string | null
          estacionamiento?: never
          fecha_actualizacion?: string | null
          fecha_entrega?: string | null
          id?: number | null
          id_propiedad?: string | null
          link_drive?: string | null
          m2_exteriores?: never
          m2_habitables?: never
          m2_roof_garden?: never
          m2_totales?: never
          nombre_desarrollador?: string | null
          nombre_kibah?: string | null
          num_banos?: never
          num_recamaras?: never
          pct_comision?: never
          precio_unidad?: never
          tipo_entrega?: string | null
          tipo_preventa?: never
          unidad?: string | null
        }
        Relationships: []
      }
      v_props: {
        Row: {
          alcaldia: string | null
          amenidades: string | null
          banos: string | null
          bodega: string | null
          colonia: string | null
          desarrollador_propietario_whats_grupo: string | null
          direccion: string | null
          disponibilidad: string | null
          entrega_inmediata_preventa: string | null
          estacionamientos: string | null
          fecha_actualizacion: string | null
          fecha_construccion_entrega: string | null
          id: number | null
          id_propiedad: string | null
          link_drive: string | null
          m2_exteriores: string | null
          m2_habitables: string | null
          m2_roof_garden_jardin: string | null
          m2_totales: string | null
          nombre_propiedad: string | null
          porcentaje_comision: string | null
          precio: string | null
          recamaras: string | null
          tipo_entrega: string | null
          unidad: string | null
        }
        Insert: {
          alcaldia?: string | null
          amenidades?: string | null
          banos?: string | null
          bodega?: string | null
          colonia?: string | null
          desarrollador_propietario_whats_grupo?: string | null
          direccion?: string | null
          disponibilidad?: string | null
          entrega_inmediata_preventa?: string | null
          estacionamientos?: string | null
          fecha_actualizacion?: string | null
          fecha_construccion_entrega?: string | null
          id?: number | null
          id_propiedad?: string | null
          link_drive?: string | null
          m2_exteriores?: string | null
          m2_habitables?: string | null
          m2_roof_garden_jardin?: string | null
          m2_totales?: string | null
          nombre_propiedad?: string | null
          porcentaje_comision?: string | null
          precio?: string | null
          recamaras?: string | null
          tipo_entrega?: string | null
          unidad?: string | null
        }
        Update: {
          alcaldia?: string | null
          amenidades?: string | null
          banos?: string | null
          bodega?: string | null
          colonia?: string | null
          desarrollador_propietario_whats_grupo?: string | null
          direccion?: string | null
          disponibilidad?: string | null
          entrega_inmediata_preventa?: string | null
          estacionamientos?: string | null
          fecha_actualizacion?: string | null
          fecha_construccion_entrega?: string | null
          id?: number | null
          id_propiedad?: string | null
          link_drive?: string | null
          m2_exteriores?: string | null
          m2_habitables?: string | null
          m2_roof_garden_jardin?: string | null
          m2_totales?: string | null
          nombre_propiedad?: string | null
          porcentaje_comision?: string | null
          precio?: string | null
          recamaras?: string | null
          tipo_entrega?: string | null
          unidad?: string | null
        }
        Relationships: []
      }
      v_props_numeric: {
        Row: {
          _banos_clean: string | null
          _estac_clean: string | null
          _m2_ext_clean: string | null
          _m2_hab_clean: string | null
          _m2_roof_clean: string | null
          _m2_tot_clean: string | null
          _precio_clean: string | null
          _rec_clean: string | null
          "% Comisión": string | null
          Alcaldia: string | null
          Amenidades: string | null
          banos_num: number | null
          Bodega: string | null
          Colonia: string | null
          created_at: string | null
          "Desarrollador/Propietario (Whats grupo)": string | null
          Dirección: string | null
          Disponibilidad: string | null
          "Entrega Inmediata/Preventa": string | null
          estacionamiento_num: number | null
          "Fecha de Actualización": string | null
          "Fecha de Construcción/Entrega": string | null
          id: number | null
          id_propiedad: string | null
          "Link Drive": string | null
          "Lugares de estacionamiento": string | null
          "M2 Exteriores": string | null
          "M2 Habitables": string | null
          "M2 Roof Garden/Jardín": string | null
          "M2 Totales": string | null
          m2_exteriores_num: number | null
          m2_habitables_num: number | null
          m2_num: number | null
          m2_roof_num: number | null
          "Nombre de la Propiedad": string | null
          "Nombre Kibah": string | null
          "Número de baños": string | null
          "Número de recámaras": string | null
          "Precio por unidad": string | null
          precio_num: number | null
          recamaras_num: number | null
          "Tipo de Entrega": string | null
          Unidad: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_and_update_generation_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      clean_numeric: { Args: { val: string }; Returns: number }
      get_table_ddl: {
        Args: { p_schema: string; p_table: string }
        Returns: string
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
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

