export interface ValidationResult {
  valid: boolean;
  errors?: ValidationIssue[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  code?: string;
}
