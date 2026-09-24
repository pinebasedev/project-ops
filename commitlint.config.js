export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci', 'build', 'perf'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'ci',
        'alchemy',
        'infra',
        'db',
        'observability',
        'integration',
        'tooling',
        'docs',
        'architecture',
      ],
    ],
    'scope-empty': [2, 'never'],
  },
};
