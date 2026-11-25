module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          allowJs: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\](?!(@noble|@scure|uuid)[/\\\\])',
  ],
};


