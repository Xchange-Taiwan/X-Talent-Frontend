export interface CategoryOption {
  value: string;
  label: string;
}

export interface Category {
  key: string;
  label: string;
  options: CategoryOption[];
}
