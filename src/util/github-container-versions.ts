import { useLogger } from '@becomes/purple-cheetah';
import axios from 'axios';

export class GithubContainerVersions {
  constructor(
    public next: string,
    public curr: string,
    public prev: string,
    public probes: string[],
  ) {}
}

export class GithubContainerVersionsManager {
  static data = new GithubContainerVersions(
    'latest',
    'latest',
    'latest',
    [],
  );
  // static http = createHttpClient({
  //   name: 'Github backend',
  //   basePath: '/bcms/backend/master',
  //   host: {
  //     name: 'raw.githubusercontent.com',
  //     port: '443',
  //   },
  // });
  private static logger = useLogger({
    name: 'Github container version manager',
  });

  static async update(): Promise<void> {
    try {
      const verRes = await axios({
        url: `https://raw.githubusercontent.com/bcms/backend/master/bcms-versions.json`,
      });
      const versions: GithubContainerVersions =
        typeof verRes.data === 'string'
          ? JSON.parse(verRes.data as string)
          : verRes.data;
      GithubContainerVersionsManager.data =
        new GithubContainerVersions(
          versions.next,
          versions.curr,
          versions.prev,
          versions.probes,
        );
    } catch (error) {
      GithubContainerVersionsManager.logger.warn('update', error);
    }
  }
}
