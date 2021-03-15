import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { App } from './app';
import { General, Security, SecurityPrototype } from './util';

let app: App;
let security: SecurityPrototype;

async function initialize() {
  if (
    !(await util.promisify(fs.exists)(
      path.join(process.cwd(), 'BCMS-LICENSE'),
    ))
  ) {
    throw Error('BCMS-LICENSE file does not exist!');
  }
  const licenseRaw = (
    await util.promisify(fs.readFile)(
      path.join(process.cwd(), 'BCMS-LICENSE'),
    )
  ).toString();
  const licenseCore = General.string.getTextBetween(
    licenseRaw,
    '---- BEGIN LICENSE ----\n',
    '\n---- END LICENSE ----',
  );
  const licenseParts: string[] = licenseCore.split('\n');
  if (licenseParts.length !== 10) {
    throw Error('Invalid license length.');
  }
  security = Security(
    licenseParts.map((e, i) => {
      return { i, str: e, buf: Buffer.from(e, 'base64') };
    }),
  );
}
initialize()
  .then(() => {
    app = new App();
    app.listen();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export const Application = app;
export const SecurityService = security;
