import { state } from './state.js';

let swapFirstPlayerId = null;
let swapGroupId = null;

// Функция генерации стандартного турнирного посева (Seeding) для степеней двойки
function getStandardSeedingOrder(size) {
    let order = [1];
    while (order.length < size) {
        const nextOrder = [];
        const target = order.length * 2 + 1;
        for (let i = 0; i < order.length; i++) {
            nextOrder.push(order[i]);
            nextOrder.push(target - order[i]);
        }
        order = nextOrder;
    }
    return order;
}

export function generateBracketForGroup(group) {
    const players = group.participantIds
        .map(id => state.participants.find(p => p.id === id))
        .filter(Boolean);

    if (players.length < 2) {
        group.bracketMatches = null;
        return;
    }

    // Разведение одноклубников
    const seededPlayers = clubSeedingAlgorithm(players);

    if (seededPlayers.length === 2) {
        group.bracketMatches = {
            type: 'final',
            matches: [{ id: 1, round: 'Финал', p1: seededPlayers[0].id, p2: seededPlayers[1].id, winner: null }]
        };
    } else if (seededPlayers.length === 3) {
        group.bracketMatches = {
            type: 'round-robin',
            matches: [
                { id: 1, round: 'Тур 1', p1: seededPlayers[0].id, p2: seededPlayers[1].id, winner: null },
                { id: 2, round: 'Тур 2', p1: seededPlayers[1].id, p2: seededPlayers[2].id, winner: null },
                { id: 3, round: 'Тур 3', p1: seededPlayers[0].id, p2: seededPlayers[2].id, winner: null }
            ]
        };
    } else {
        group.bracketMatches = buildOlympicTree(seededPlayers);
    }
}

function clubSeedingAlgorithm(players) {
    const clubMap = {};
    players.forEach(p => {
        if (!clubMap[p.club]) clubMap[p.club] = [];
        clubMap[p.club].push(p);
    });
    const sortedClubs = Object.keys(clubMap).sort((a, b) => clubMap[b].length - clubMap[a].length);
    const result = [];
    let processing = true;
    while (processing) {
        processing = false;
        sortedClubs.forEach(club => {
            if (clubMap[club].length > 0) {
                result.push(clubMap[club].shift());
                processing = true;
            }
        });
    }
    return result;
}

// Исправленная функция построения олимпийского дерева
function buildOlympicTree(players) {
    const N = players.length;
    let M = 4;
    while (M < N) M *= 2; 

    const seedingOrder = getStandardSeedingOrder(M);
    const initialSlots = new Array(M).fill(null);
    for (let i = 0; i < N; i++) {
        const seedPosition = seedingOrder.indexOf(i + 1);
        initialSlots[seedPosition] = players[i].id;
    }

    const matches = [];
    let matchId = 1;

    const getRoundName = (slotsCount) => {
        if (slotsCount === 4) return 'Полуфинал';
        if (slotsCount === 8) return '1/4 Финала';
        if (slotsCount === 16) return '1/8 Финала';
        return `1/${slotsCount / 2} Финала`;
    };

    // --- РАУНД 1: Только здесь работает авто-проход для bye ---
    const round1Name = getRoundName(M);
    const round1Matches = [];

    for (let i = 0; i < M; i += 2) {
        const p1 = initialSlots[i];
        const p2 = initialSlots[i + 1];
        
        let winner = null;
        let isBye = false;

        // Если одного из бойцов вообще нет в природе на этом турнире
        if (p1 !== null && p2 === null) { winner = p1; isBye = true; }
        if (p2 !== null && p1 === null) { winner = p2; isBye = true; }

        const match = {
            id: matchId++,
            round: round1Name,
            p1: p1,
            p2: p2,
            winner: winner, 
            isByeMatch: isBye
        };
        matches.push(match);
        round1Matches.push(match);
    }

    // --- ПОСЛЕДУЮЩИЕ РАУНДЫ: Никаких авто-побед до финала! ---
    let prevRoundMatches = round1Matches;
    let nextSlotsCount = M / 4;

    while (nextSlotsCount >= 1) {
        const currentRoundName = nextSlotsCount === 1 ? 'Финал' : getRoundName(nextSlotsCount * 2);
        const currentRoundMatches = [];

        for (let i = 0; i < prevRoundMatches.length; i += 2) {
            const m1 = prevRoundMatches[i];
            const m2 = prevRoundMatches[i + 1];

            // Подтягиваем победителей из предыдущего раунда
            const p1 = m1.winner;
            const p2 = m2.winner;

            const match = {
                id: matchId++,
                round: currentRoundName,
                p1: p1,
                p2: p2,
                winner: null, // Изначально победителя НЕТ, пока не проведут бой!
                isByeMatch: false 
            };
            
            matches.push(match);
            currentRoundMatches.push(match);
        }

        prevRoundMatches = currentRoundMatches;
        nextSlotsCount /= 2;
    }

    // Матч за 3-е место
    matches.push({
        id: matchId++,
        round: 'За 3-е место',
        p1: null,
        p2: null,
        winner: null,
        isByeMatch: false
    });

    return {
        type: 'olympic',
        size: M,
        matches: matches
    };
}


export function drawBracketToContainer(group, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!group || group.isUnassigned) {
        container.innerHTML = '<p style="color: #64748b; text-align:center;">Для этой группы сетка недоступна.</p>';
        return;
    }

    if (!group.bracketMatches) {
        generateBracketForGroup(group);
    }

    const bm = group.bracketMatches;
    if (!bm || bm.matches.length === 0) {
        container.innerHTML = '<p style="color: #64748b; text-align:center;">Недостаточно участников для построения сетки.</p>';
        return;
    }

    // --- КРУГОВАЯ ИЛИ ФИНАЛ (мало людей) ---
    if (bm.type === 'final' || bm.type === 'round-robin') {
        const wrap = document.createElement('div');
        wrap.className = 'bracket-round';
        wrap.style.gap = '20px';
        bm.matches.forEach(match => {
            wrap.appendChild(createMatchDOM(match, group.id));
        });
        container.appendChild(wrap);
        return;
    }

    // --- ОЛИМПИЙСКАЯ СИСТЕМА (4+ участников) ---
    if (bm.type === 'olympic') {
        const treeWrap = document.createElement('div');
        treeWrap.className = 'bracket-tree';

        // Группируем матчи по раундам
        const rounds = {};
        bm.matches.forEach(m => {
            if (m.round === 'За 3-е место') return; // Логику вывода этого матча меняем
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        const roundNames = Object.keys(rounds);

        // Отрисовываем каждый раунд по очереди
        roundNames.forEach((roundName, index) => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'bracket-round';

            let visibleMatchesInRound = 0;

            rounds[roundName].forEach(match => {
                if (match.isByeMatch) return; // Пропускаем технические bye-матчи
                roundDiv.appendChild(createMatchDOM(match, group.id));
                visibleMatchesInRound++;
            });

            // ТРЕБОВАНИЕ: Если это ПОСЛЕДНИЙ раунд (Финал), встраиваем бой за 3-е место прямо под ним!
            const isLastRound = (index === roundNames.length - 1);
            if (isLastRound) {
                const match3 = bm.matches.find(m => m.round === 'За 3-е место');
                if (match3) {
                    // Создаем небольшой пустой разделитель для красоты перед 3-м местом
                    const spacer = document.createElement('div');
                    spacer.style.height = '14px';
                    spacer.style.borderTop = '1px dashed #334155';
                    spacer.style.marginTop = '10px';
                    roundDiv.appendChild(spacer);

                    // Добавляем ноду за 3-е место прямо в этот же столбец
                    roundDiv.appendChild(createMatchDOM(match3, group.id));
                    visibleMatchesInRound++;
                }
            }

            if (visibleMatchesInRound > 0) {
                treeWrap.appendChild(roundDiv);
            }
        });

        container.appendChild(treeWrap);
    }
}

function createMatchDOM(match, groupId) {
    const matchDiv = document.createElement('div');
    matchDiv.className = 'bracket-match';

    const p1 = state.participants.find(p => p.id === match.p1);
    const p2 = state.participants.find(p => p.id === match.p2);

    matchDiv.innerHTML = `
        <div style="font-size: 0.7rem; color: #94a3b8; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">${match.round}</div>
        <div class="match-slot ${swapFirstPlayerId === match.p1 && match.p1 ? 'swap-active' : ''}" data-player-id="${match.p1 || ''}">
            ${p1 ? `<b>${p1.name}</b> <div style="font-size:0.65rem; color:#64748b;">${p1.club} | ${p1.city} | ${p1.kyu}</div>` : `<span style="color:#475569;">— Ожидается —</span>`}
        </div>
        <div class="match-slot ${swapFirstPlayerId === match.p2 && match.p2 ? 'swap-active' : ''}" data-player-id="${match.p2 || ''}">
            ${p2 ? `<b>${p2.name}</b> <div style="font-size:0.65rem; color:#64748b;">${p2.club} | ${p2.city} | ${p1.kyu}</div>` : `<span style="color:#475569;">— Ожидается —</span>`}
        </div>
    `;

    matchDiv.querySelectorAll('.match-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const playerId = slot.dataset.playerId ? Number(slot.dataset.playerId) : null;
            if (!playerId) return; 

            if (swapFirstPlayerId === null) {
                swapFirstPlayerId = playerId;
                swapGroupId = groupId;
                slot.classList.add('swap-active');
                executeSwapUIUpdate(groupId);
            } else {
                if (swapGroupId === groupId) {
                    executeStateSwap(groupId, swapFirstPlayerId, playerId);
                }
                swapFirstPlayerId = null;
                swapGroupId = null;
                executeSwapUIUpdate(groupId);
            }
        });
    });

    return matchDiv;
}

function executeStateSwap(groupId, id1, id2) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group || !group.bracketMatches) return;

    // Свапаем бойцов во всех матчах дерева, где они фигурируют в данный момент
    group.bracketMatches.matches.forEach(m => {
        if (m.p1 === id1) m.p1 = id2;
        else if (m.p1 === id2) m.p1 = id1;

        if (m.p2 === id1) m.p2 = id2;
        else if (m.p2 === id2) m.p2 = id1;
    });

    // Важно: пересчитываем победителей для автоматических bye-матчей первого раунда после свапа!
    group.bracketMatches.matches.forEach(m => {
        if (m.isByeMatch) {
            if (m.p1 !== null && m.p2 === null) m.winner = m.p1;
            else if (m.p2 !== null && m.p1 === null) m.winner = m.p2;
            else m.winner = null;
        }
    });

    // Прокидываем обновленных победителей на раунд выше для bye-связей
    updateOlympicTreeWinnersChain(group.bracketMatches);
}

// Исправленная функция обновления цепочки при свапе
function updateOlympicTreeWinnersChain(bm) {
    if (bm.type !== 'olympic') return;
    
    const roundsMap = {};
    bm.matches.forEach(m => {
        if (m.round === 'За 3-е место') return;
        if (!roundsMap[m.round]) roundsMap[m.round] = [];
        roundsMap[m.round].push(m);
    });

    const roundsNames = Object.keys(roundsMap); 

    for (let r = 0; r < roundsNames.length - 1; r++) {
        const currentRoundMatches = roundsMap[roundsNames[r]];
        const nextRoundMatches = roundsMap[roundsNames[r + 1]];

        for (let i = 0; i < currentRoundMatches.length; i += 2) {
            const m1 = currentRoundMatches[i];
            const m2 = currentRoundMatches[i + 1];
            const nextMatch = nextRoundMatches[i / 2];

            if (nextMatch) {
                // Передаем бойцов наверх
                nextMatch.p1 = m1.winner;
                nextMatch.p2 = m2.winner;
                
                // Сбрасываем победителя верхнего уровня, так как состав пар изменился,
                // и теперь этот бой в будущем нужно будет судить заново.
                nextMatch.winner = null; 
            }
        }
    }
}

function executeSwapUIUpdate(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    drawBracketToContainer(group, 'group-bracket-preview');
    drawBracketToContainer(group, 'bracket-tree');
}

export function renderBrackets() {
    const filteredGroups = state.groups.filter(g => !g.isUnassigned && g.gender === state.activeTab);
    
    if (filteredGroups.length === 0) {
        document.getElementById('bracket-group-title').innerText = "Нет созданных групп";
        document.getElementById('bracket-tree').innerHTML = "";
        document.getElementById('bracket-group-counter').innerText = "0 из 0";
        return;
    }

    if (state.currentBracketGroupIndex >= filteredGroups.length) {
        state.currentBracketGroupIndex = 0;
    }

    const activeGroup = filteredGroups[state.currentBracketGroupIndex];
    document.getElementById('bracket-group-title').innerText = activeGroup.name;
    document.getElementById('bracket-group-counter').innerText = `Группа ${state.currentBracketGroupIndex + 1} из ${filteredGroups.length}`;

    drawBracketToContainer(activeGroup, 'bracket-tree');
}