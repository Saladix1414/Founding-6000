/* Schema-only integration into FoundingCore. Writers are not exposed as Worker routes. */
import { initializeMembershipRegistry } from './oxMembershipRegistry.mjs';
import { initializeReserveRegistry } from './oxReserveRegistry.mjs';
import { initializeRedemptionRegistry } from './oxRedemptionRegistry.mjs';

export function initializeFoundingProductRegistries(storage) {
  initializeMembershipRegistry(storage);
  initializeReserveRegistry(storage);
  initializeRedemptionRegistry(storage);
}
