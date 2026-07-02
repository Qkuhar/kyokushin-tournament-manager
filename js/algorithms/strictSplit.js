import { state } from '../state.js';

export function runStrictSplit() {
    const AGE_GROUPS = [
        { min: 0, max: 4 },
        { min: 6, max: 7 },
        { min: 8, max: 9 },
        { min: 10, max: 11 },
        { min: 12, max: 13 },
        { min: 14, max: 15 },
        { min: 16, max: 17 },
        { min: 18, max: 44 },
        { min: 45, max: 120 },
    ];

    const WEIGHT_STOPS = [0, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 200];

    const unassignedGroup = state.groups.find(g => g.id === 'unassigned');
    if (!unassignedGroup) return false;

    // Берем кандидатов текущего пола
    let candidatesIds = [...unassignedGroup.participantIds];
    
    let distributedCount = 0;
    let createdGroupsCount = 0;
    let addedToExistingCount = 0;

    // Массив для тех, кто не поместился в существующие группы
    const remainingCandidates = [];

    // --- ШАГ 1: ПРОВЕРКА СУЩЕСТВУЮЩИХ ГРУПП ---
    // Проверяем каждого бойца по отдельности
    candidatesIds.forEach(id => {
        const player = state.participants.find(p => p.id === id);
        if (!player || player.gender !== state.activeTab) return;

        // Ищем первую подходящую по параметрам существующую группу (кроме "Неопределенных")
        const targetGroup = state.groups.find(g => {
            if (g.isUnassigned || g.gender !== state.activeTab) return false;
            
            const ageMatch = player.age >= g.minAge && player.age <= g.maxAge;
            const weightMatch = player.weight >= g.minWeight && player.weight < g.maxWeight;
            
            return ageMatch && weightMatch;
        });

        if (targetGroup) {
            // Если группа есть, добавляем бойца туда (даже если он там один)
            targetGroup.participantIds.push(player.id);
            
            // Удаляем из списка неопределенных
            unassignedGroup.participantIds = unassignedGroup.participantIds.filter(pid => pid !== player.id);
            
            addedToExistingCount++;
            distributedCount++;
        } else {
            // Если группы нет, отправляем в список на создание новых групп
            remainingCandidates.push(player);
        }
    });

    // --- ШАГ 2: СОЗДАНИЕ НОВЫХ ГРУПП ДЛЯ ОСТАВШИХСЯ ---
    AGE_GROUPS.forEach(ageRange => {
        for (let i = 0; i < WEIGHT_STOPS.length - 1; i++) {
            const minW = WEIGHT_STOPS[i];
            const maxW = WEIGHT_STOPS[i + 1];

            // Фильтруем среди оставшихся тех, кто подходит под этот строгий шаг
            const matchingPlayers = remainingCandidates.filter(p => {
                const ageMatch = p.age >= ageRange.min && p.age <= ageRange.max;
                const weightMatch = p.weight >= minW && p.weight < maxW;
                return ageMatch && weightMatch;
            });

            // Новую группу создаем только если набралось хотя бы 2 человека
            if (matchingPlayers.length >= 2) {
                const genderText = state.activeTab === 1 ? 'Мальчики' : 'Девочки';
                const groupName = `${genderText} ${ageRange.min}-${ageRange.max} лет, ${minW}-${maxW} кг`;

                const newGroupId = `group_strict_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const playerIds = matchingPlayers.map(p => p.id);

                state.groups.push({
                    id: newGroupId,
                    name: groupName,
                    gender: state.activeTab,
                    minAge: ageRange.min,
                    maxAge: ageRange.max,
                    minWeight: minW,
                    maxWeight: maxW,
                    minKyu: 1,
                    maxKyu: 10,
                    participantIds: playerIds
                });

                // Вырезаем их из неопределенных
                unassignedGroup.participantIds = unassignedGroup.participantIds.filter(
                    id => !playerIds.includes(id)
                );

                createdGroupsCount++;
                distributedCount += playerIds.length;
            }
        }
    });

    // --- ШАГ 3: ОТЧЕТ ---
    if (distributedCount > 0) {
        let msg = `Распределение завершено!\n`;
        if (addedToExistingCount > 0) msg += `Добавлено в существующие группы: ${addedToExistingCount} чел.\n`;
        if (createdGroupsCount > 0) msg += `Создано новых строго регламентированных групп: ${createdGroupsCount}.\n`;
        alert(msg);
        return true;
    } else {
        alert("Некого распределять или не удалось найти подходящих пар для создания новых групп.");
        return false;
    }
}