import type { Container } from './container';
import type { Nginx } from './nginx';

export interface Manager {
  nginx: Nginx;
  container: {
    findAll(): Container[];
    findByDomain(domainName: string): Container | undefined;
    findById(id: string): Container | undefined;
    start(id: string): Promise<boolean>;
    stop(id: string): Promise<boolean>;
    restart(id: string): Promise<boolean>;
    remove(id: string): Promise<boolean>;
    build(id: string): Promise<boolean>;
    run(id: string): Promise<boolean>;
  };
}
