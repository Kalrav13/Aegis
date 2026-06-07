export const PACKAGE_FILES: Record<string, "npm" | "composer" | "cargo" | "bundler" | "go" | "python" | "maven" | "gradle"> = {
  'package.json': 'npm',
  'composer.json': 'composer',
  'cargo.toml': 'cargo',
  'gemfile': 'bundler',
  'go.mod': 'go',
  'requirements.txt': 'python',
  'pom.xml': 'maven',
  'build.gradle': 'gradle'
};

export const CONFIG_FILES: Record<string, string> = {
  'tsconfig.json': 'typescript',
  'next.config.js': 'nextjs',
  'tailwind.config.js': 'tailwind',
  'postcss.config.js': 'postcss',
  'webpack.config.js': 'webpack',
  '.eslintrc.json': 'eslint',
  'vite.config.ts': 'vite',
  'docker-compose.yml': 'docker-compose'
};
