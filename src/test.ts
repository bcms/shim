import { Http } from './util';

async function main() {
  const http = new Http('localhost', '2080', '/api/v1/shim');
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
