import { state } from './state.js';
import { render } from './render.js';

export const dndState = {
    draggedPlayerId: null,
    draggedFromGroupId: null
};

export function movePlayer(playerId, fromGroupId, toGroupId) {
    state.groups = state.groups.map(g => {
        if (g.id === fromGroupId) g.participantIds = g.participantIds.filter(id => id !== playerId);
        if (g.id === toGroupId) g.participantIds.push(playerId);
        return g;
    });
    dndState.draggedPlayerId = null;
    dndState.draggedFromGroupId = null;
    render();
}