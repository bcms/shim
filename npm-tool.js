const path = require('path');
const { createFS } = require('@banez/fs');
const { createConfig, createTasks } = require('@banez/npm-tool');
const { ChildProcess } = require('@banez/child_process');

const fs = createFS({
  base: process.cwd(),
});

module.exports = createConfig({
  bundle: {
    extend: [
      {
        title: 'Update package.json',
        async task() {
          const packageJson = JSON.parse(
            await fs.readString(['dist', 'package.json']),
          );
          packageJson.scripts = {
            start: 'node main.js',
          };
          await fs.save(
            ['dist', 'package.json'],
            JSON.stringify(packageJson, null, '  '),
          );
        },
      },
    ],
  },
  custom: {
    '--create-image': async () => {
      await createTasks([
        {
          title: 'Create lib directory',
          async task() {
            await fs.copy('dist', 'lib');
            await fs.copy('Dockerfile', ['lib', 'Dockerfile']);
          },
        },
        {
          title: 'Copy proxy config',
          async task() {
            await fs.copy('proxy', ['lib', 'proxy']);
          },
        },
        {
          title: 'Create Docker image',
          async task() {
            await ChildProcess.exec(
              'cd lib && docker build . -t becomes/cms-shim',
              (type, chunk) => {
                process[type].write(chunk);
              },
            );
          },
        },
        {
          title: 'Remove lib directory',
          async task() {
            await fs.deleteDir('lib');
          },
        },
      ]).run();
    },
    '--create-dev-image': async () => {
      await createTasks([
        {
          title: 'Remove local dev dist',
          async task() {
            await fs.deleteDir('local-dev-dist');
          },
        },
        {
          title: 'Copy src',
          async task() {
            await fs.copy('src', ['local-dev-dist', 'src']);
          },
        },
        {
          title: 'Copy assets',
          async task() {
            await fs.mkdir(['local-dev-dist', 'license']);
            const files = [
              'tsconfig.json',
              '.eslintrc',
              '.eslintignore',
              '.env.dev',
            ];
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              await fs.copy(file, ['local-dev-dist', file]);
            }
          },
        },
        {
          title: 'Copy package.json.',
          task: async () => {
            await fs.copy('package.json', [
              'local-dev-dist',
              'package.json',
            ]);
          },
        },
        {
          title: 'Copy Dockerfile',
          task: async () => {
            await fs.copy('Dockerfile.dev', [
              'local-dev-dist',
              'Dockerfile',
            ]);
          },
        },
        {
          title: 'Create Docker image',
          task: async () => {
            await ChildProcess.spawn(
              'docker',
              ['build', '.', '-t', 'becomes/cms-shim-local'],
              {
                stdio: 'inherit',
                cwd: path.join(__dirname, 'local-dev-dist'),
              },
            );
          },
        },
      ]).run();
    },
  },
});
