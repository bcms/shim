import type { Container } from './container';

export interface Manager {
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
