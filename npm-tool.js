const { createConfig, createTasks } = require('@banez/npm-tool');
const { createFS } = require('@banez/fs');
const { ChildProcess } = require('@banez/child_process');

const fs = createFS({
  base: __dirname,
});

module.exports = createConfig({
  bundle: {
    extend: [
      {
        title: 'Fix imports',
        task: async () => {
          const filePaths = await fs.fileTree(['dist'], '');
          for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            if (filePath.path.abs.endsWith('.js') || filePath.path.abs.endsWith('.d.ts')) {
              let replacer = './';
              if (filePath.path.rel !== '') {
                const depth = filePath.path.rel.split('/').length;
                replacer = new Array(depth)
                  .fill('..')
                  .slice(1)
                  .join('/');
              }
              const file = await fs.readString(filePath.path.abs);
              const fileFixed = file.replace(
                /@shim/g,
                replacer,
              );
              if (file !== fileFixed) {
                await fs.save(filePath.path.abs, fileFixed);
              }
            }
          }
        },
      },
      {
        title: 'Create types output',
        task: async () => {
          const fileTree = await fs.fileTree(['dist'], '');
          if (await fs.exist('dist-types')) {
            await fs.deleteDir('dist-types');
          }
          await fs.mkdir('dist-types');
          for (let i = 0; i < fileTree.length; i++) {
            const fileInfo = fileTree[i];
            if (fileInfo.path.rel.endsWith('.ts')) {
              await fs.copy(fileInfo.path.abs, [
                'dist-types',
                fileInfo.path.rel,
              ]);
            }
          }
          const packageJson = JSON.parse(
            await fs.readString('package.json'),
          );
          packageJson.name = '@becomes/cms-cloud-types';
          packageJson.scripts = undefined;
          packageJson.devDependencies = undefined;
          packageJson.nodemonConfig = undefined;
          await fs.save(
            ['dist-types', 'package.json'],
            JSON.stringify(packageJson, null, '  '),
          );
        },
      },
    ],
  },
  custom: {
    '--precommit': async () => {
      // await ChildProcess.spawn('npm', ['run', 'lint']);
      // await ChildProcess.spawn('npm', ['run', 'bundle']);
    },

    '--create-image': async () => {
      await createTasks([
        {
          title: 'Create bundle',
          task: async () => {
            await ChildProcess.spawn('npm', ['run', 'bundle']);
          },
        },
        {
          title: 'Copy Dockerfile',
          task: async () => {
            await fs.copy('Dockerfile', ['dist', 'Dockerfile']);
          },
        },
        {
          title: 'Create docker image',
          task: async () => {
            const versions = JSON.parse(
              await fs.readString('container-version.json'),
            );
            await ChildProcess.spawn('docker', [
              'tag',
              '.',
              '-t',
              'registry.digitalocean.com/bcms-cloud/backend',
            ]);
            await ChildProcess.spawn('docker', [
              'build',
              'registry.digitalocean.com/bcms-cloud/backend',
              `registry.digitalocean.com/bcms-cloud/backend:${versions.v2}`,
            ]);
            const [major, minor, fix] = versions.v2
              .split('.')
              .map((e) => parseInt(e));
            fix++;
            versions.v2 = `${major}.${minor}.${fix}`;
            await fs.save(
              'container-version.json',
              JSON.stringify(versions, null, '  '),
            );
          },
        },
        {
          title: 'Remove Dockerfile',
          task: async () => {
            await fs.deleteFile(['dist', 'Dockerfile']);
          },
        },
      ]).run();
    },
  },
});
