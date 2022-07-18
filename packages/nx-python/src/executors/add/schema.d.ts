export interface AddExecutorSchema {
  name: string;
  local: boolean;
  args?: string;
  group?: string;
  extras?: string[];
}
