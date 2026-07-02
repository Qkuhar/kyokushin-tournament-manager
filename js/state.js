export const state = {
    participants: [],
    groups: [
        { id: 'unassigned', name: 'Неопределенные', isUnassigned: true, participantIds: [] }
    ],
    activeTab: 1, 
    currentBracketGroupIndex: 0
};

export function getHashIndex(str, max) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
    return hash % max;
}