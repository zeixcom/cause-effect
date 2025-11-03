type DiffResult<T extends Record<string, unknown & {}> = Record<string, unknown & {}>> = {
    changed: boolean;
    add: Partial<T>;
    change: Partial<T>;
    remove: Partial<T>;
};
declare const diff: <T extends Record<string, unknown & {}> = Record<string, {}>>(oldObj: T, newObj: T) => DiffResult<T>;
export { type DiffResult, diff };
