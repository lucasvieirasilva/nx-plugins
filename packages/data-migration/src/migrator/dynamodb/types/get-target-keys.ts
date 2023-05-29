export type TargetKey<T, HashKey extends keyof T, Rangekey extends keyof T> = {
  [key in HashKey | Rangekey]: T[key];
};

export type GetTargetKeys<
  T,
  HashKey extends keyof T,
  Rangekey extends keyof T
> = (
  keys: Pick<T, HashKey | Rangekey>
) => Promise<TargetKey<T, HashKey, Rangekey>>;
