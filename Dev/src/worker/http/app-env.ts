import type { Env } from '../env';
import type { AuthenticatedUser } from '../modules/identity';

export type AppEnv = {
  Bindings: Env;
  Variables: { user: AuthenticatedUser };
};
