// A registry belongs to an editor. Weak keys let its claims disappear with it.
const editors = new WeakMap();

export function claimItemId(registry, entityId, items, clientId, uuid, candidate) {
	let scope = editors.get(registry);
	if (!scope || scope.entityId !== entityId) {
		scope = { entityId, claims: new Map() };
		editors.set(registry, scope);
	}
	const { claims } = scope;
	const current = new Map(items.map((item) => [item.clientId, item.uuid]));
	for (const [id, claim] of claims) {
		if (!current.has(claim.clientId) ||
			(current.get(claim.clientId) !== id && current.get(claim.clientId) !== claim.previousUuid)) {
			claims.delete(id);
		} else if (current.get(claim.clientId) === id) {
			// Once the write lands, a later edit must release the old claim.
			claim.previousUuid = id;
		}
	}
	// Seed loaded IDs in document order, without displacing established owners.
	for (const item of items) {
		if (item.uuid !== undefined && !claims.has(item.uuid)) {
			claims.set(item.uuid, { clientId: item.clientId, previousUuid: item.uuid });
		}
	}
	if (uuid !== undefined && (!claims.has(uuid) || claims.get(uuid).clientId === clientId)) {
		claims.set(uuid, { clientId, previousUuid: uuid });
		return uuid;
	}
	// Reuse an outstanding reservation if attributes have not caught up yet.
	for (const [id, claim] of claims) {
		if (claim.clientId === clientId) {
			return id;
		}
	}
	while (claims.has(candidate)) {
		candidate++;
	}
	claims.set(candidate, { clientId, previousUuid: uuid });
	return candidate;
}
