export interface BuilderOption {
  type: 'select' | 'toggle' | 'slider' | 'label' | 'divider' | 'textarea' | 'chips';
  key?: string;
  label?: string;
  options?: string[] | { label: string; value: string }[];
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  items?: { label: string; value: string }[];
}

export interface BuilderConfig {
  label: string;
  sub: string;
  badge: string;
  badgeClass: string;
  formats: string;
  optionsTitle: string;
  optionsSub: string;
  category: string;
  options: BuilderOption[];
  systemPrompt: (opts: Record<string, string | number | boolean>) => string;
}

export interface UploadedFile {
  id: string;
  name: string;
  ext: string;
  text?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  type: string;
  category: string;
  description: string;
  builderPrompt: string;
  builderType: string;
  icon?: string;
}

export interface RecommendationSet {
  id: string;
  sourceTitle: string;
  createdAt: string;
  recommendations: Recommendation[];
}
