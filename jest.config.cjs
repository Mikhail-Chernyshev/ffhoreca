/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/mobile/', '<rootDir>/server/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          isolatedModules: true,
        },
        astTransformers: {
          before: [
            {
              path: 'ts-jest-mock-import-meta',
              options: {
                metaObjectReplacement: {
                  env: {
                    BASE_URL: '/',
                    VITE_ADMIN_EMAIL: 'admin@example.com',
                    VITE_API_BASE_URL: 'https://api.example.test',
                    VITE_ADMIN_PLACES_API: '',
                    VITE_OSRM_BASE_URL: '',
                    VITE_GOOGLE_PLACES_API_KEY: '',
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
};
