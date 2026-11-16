import { DurableObject } from 'cloudflare:workers';
import { handleRequest, dispatchRefresh } from './gate.js';

export class RefreshGate extends DurableObject {
  fetch() {
    return dispatchRefresh(this.ctx.storage.kv, this.env);
  }
}

export default { fetch: handleRequest };
