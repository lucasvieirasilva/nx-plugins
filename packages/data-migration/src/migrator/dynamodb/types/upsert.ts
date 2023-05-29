export type Upsert<T, Haskey extends keyof T, Rangekey extends keyof T> = (
  keys: Pick<T, Haskey | Rangekey>
) => Promise<void>;
