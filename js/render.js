import { state, getHashIndex } from './state.js';
import { dndState, movePlayer } from './dnd.js';

export function render() {
    const unassignedCol = document.getElementById('unassigned-column');
    const definedGrid = document.getElementById('defined-groups-grid');
    
    if (!unassignedCol || !definedGrid) return;

    unassignedCol.innerHTML = '';
    definedGrid.innerHTML = '';

    const filteredGroups = state.groups.filter(g => g.isUnassigned || g.gender === state.activeTab);

    filteredGroups.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = `group-card ${group.isUnassigned ? 'unassigned' : ''}`;
        groupEl.dataset.id = group.id;

        const groupPlayers = group.participantIds
            .map(id => state.participants.find(p => p.id === id))
            .filter(p => p && (group.isUnassigned ? p.gender === state.activeTab : true));

        // Формируем шапку группы с кнопками (если группа не "Неопределенные")
        let actionButtons = '';
        if (!group.isUnassigned) {
            actionButtons = `
                <div class="group-actions">
                    <button class="btn-icon edit-group-btn" data-id="${group.id}" title="Редактировать параметры">✏️</button>
                    <button class="btn-icon delete-group-btn" data-id="${group.id}" title="Удалить группу">❌</button>
                </div>
            `;
        }

        groupEl.innerHTML = `
            <div class="group-header">
                <span class="group-title">${group.name}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge">${groupPlayers.length} чел.</span>
                    ${actionButtons}
                </div>
            </div>
            ${!group.isUnassigned ? `<div class="group-meta">Возраст: ${group.minAge}-${group.maxAge} | Вес: ${group.minWeight}-${group.maxWeight} кг | Кю: ${group.minKyu}-${group.maxKyu}</div>` : ''}
            <div class="cards-container" data-group-id="${group.id}"></div>
        `;

        const container = groupEl.querySelector('.cards-container');

        groupPlayers.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-card';
            playerEl.draggable = true;
            playerEl.dataset.id = player.id;

            // ПРОВЕРКА СООТВЕТСТВИЯ ПАРАМЕТРАМ ГРУППЫ
            if (!group.isUnassigned) {
                const isAgeValid = player.age >= group.minAge && player.age <= group.maxAge;
                const isWeightValid = player.weight >= group.minWeight && player.weight <= group.maxWeight;
                const isKyuValid = player.kyu >= group.minKyu && player.kyu <= group.maxKyu;

                // Если хоть один параметр не подходит — красим карточку в розовый
                if (!isAgeValid || !isWeightValid || !isKyuValid) {
                    playerEl.classList.add('invalid-parameter');
                    playerEl.title = "Внимание: Параметры участника не подходят под требования группы!";
                }
            }

            const clubClass = `tag-club-${getHashIndex(player.club, 3)}`;
            const cityClass = `tag-city-${getHashIndex(player.city, 3)}`;

            playerEl.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="tags">
                    <span class="tag ${clubClass}">${player.club}</span>
                    <span class="tag ${cityClass}">${player.city}</span>
                    <span class="tag tag-kyu">${player.kyu} Кю</span>
                    <span class="tag" style="background:#f1f5f9; color:#475569">${player.age} л / ${player.weight} кг</span>
                </div>
            `;

            playerEl.addEventListener('dragstart', (e) => {
                dndState.draggedPlayerId = player.id;
                dndState.draggedFromGroupId = group.id;
                e.dataTransfer.setData('text/plain', player.id);
            });

            playerEl.addEventListener('dblclick', () => {
                //if (group.isUnassigned) {
                //    alert("Нельзя редактировать параметры участников в группе 'Неопределенные'. Перенесите участника в созданную группу.");
                //    return;
                //}
                openEditModalGlobal(player);
            });

            container.appendChild(playerEl);
        });

        // Слушатели на кнопки внутри шапки группы
        if (!group.isUnassigned) {
            groupEl.querySelector('.delete-group-btn').addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('delete-group', { detail: group.id }));
            });
            groupEl.querySelector('.edit-group-btn').addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('edit-group', { detail: group.id }));
            });
        }

        groupEl.addEventListener('dragover', (e) => e.preventDefault());
        groupEl.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dndState.draggedFromGroupId && dndState.draggedFromGroupId !== group.id) {
                movePlayer(Number(dndState.draggedPlayerId), dndState.draggedFromGroupId, group.id);
            }
        });

        if (group.isUnassigned) {
            unassignedCol.appendChild(groupEl);
        } else {
            definedGrid.appendChild(groupEl);
        }
    });
}

function openEditModalGlobal(player) {
    document.getElementById('edit-id').value = player.id;
    document.getElementById('edit-name').value = player.name;
    document.getElementById('edit-age').value = player.age;
    document.getElementById('edit-weight').value = player.weight;
    document.getElementById('edit-city').value = player.city;
    document.getElementById('edit-club').value = player.club;
    document.getElementById('edit-kyu').value = player.kyu;
    document.getElementById('edit-modal').classList.remove('hidden');
}