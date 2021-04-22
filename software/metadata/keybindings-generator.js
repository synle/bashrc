function _combineKeys(vskeys, sublkeys, mode = "windows") {
  const map = {};
  for (binding of vskeys) {
    const { key, ...rest } = binding;
    map[binding.key] = map[binding.key] || { mode };
    map[binding.key].vs = rest;
  }

  for (binding of sublkeys) {
    const { key, ...rest } = binding;
    map[binding.key] = map[binding.key] || { mode };
    map[binding.key].subl = rest;
  }
  return map;
}
