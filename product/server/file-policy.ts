export type FilePolicyBindings = {
  FILES_MAX_TOTAL_BYTES?: string;
  FILES_MAX_COUNT?: string;
};
export function filePolicy(env: FilePolicyBindings) {
  const limit = (value: string | undefined) => {
    if (value === undefined) return null;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
      throw new Error("File quotas must be positive safe integers.");
    return Number(value);
  };
  return {
    maxBytes: limit(env.FILES_MAX_TOTAL_BYTES),
    maxCount: limit(env.FILES_MAX_COUNT),
  };
}
