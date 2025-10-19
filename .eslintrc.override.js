module.exports = {
  overrides: [
    {
      files: ['**/StableWorldMap.tsx', '**/RealWorldMap.tsx', '**/MapView.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off'
      }
    },
    {
      files: ['src/types/*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-interface': 'off'
      }
    }
  ]
};
