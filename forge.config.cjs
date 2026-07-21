const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  packagerConfig: {
    asar: false,
    prune: false,
    executableName: 'ATIRA',
    icon: path.resolve(__dirname, 'assets', 'atira'),
    ignore: (filePath) => {
      const relativePath = /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')
        ? path.relative(__dirname, filePath)
        : filePath.replace(/^[\\/]+/, '');
      if (!relativePath || relativePath.startsWith('..')) return false;
      const topLevelEntry = relativePath.split(/[\\/]/)[0];
      return !['assets', 'desktop', 'dist', 'package.json'].includes(topLevelEntry);
    },
    afterCopy: [(buildPath, _electronVersion, _platform, _arch, callback) => {
      try {
        const packagePath = path.join(buildPath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        packageJson.main = 'desktop/app/main.mjs';
        packageJson.dependencies = {};
        packageJson.devDependencies = {};
        fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
        callback();
      } catch (error) {
        callback(error);
      }
    }],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ATIRA',
        authors: 'ATIRA',
        description: 'A private, passive life timeline and personal analytics companion.',
        setupIcon: path.resolve(__dirname, 'assets', 'atira.ico'),
      },
    },
  ],
};
