export interface Agent {
  id: string;
  name: string;
  description: string;
  uri: string;
  category: string;
  icon_name: string;
  is_pinned?: boolean;
  created_at?: string;
}
