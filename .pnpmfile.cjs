const DEPENDENCY_MAPS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

function sortDependencyMaps(packageJson) {
  for (const field of DEPENDENCY_MAPS) {
    const dependencies = packageJson[field];
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
    packageJson[field] = Object.fromEntries(
      Object.keys(dependencies)
        .sort()
        .map((name) => [name, dependencies[name]]),
    );
  }
  return packageJson;
}

module.exports = {
  hooks: {
    beforePacking: sortDependencyMaps,
  },
  sortDependencyMaps,
};
