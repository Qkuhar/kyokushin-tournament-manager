import { state } from './state.js';
import { render } from './render.js';
import { initExcel, exportToExcel } from './excel.js';
import { renderBrackets, drawBracketToContainer, generateBracketForGroup } from './brackets.js';

// НОВЫЕ ИМПОРТЫ ИЗ ПАПКИ ALGORITHMS
import { runStrictSplit } from './algorithms/strictSplit.js';
import { runSmartFill } from './algorithms/smartFill.js';
// --- НАВЕШИВАНИЕ СОБЫТИЙ ИНТЕРФЕЙСА ---

// Вкладки Мальчики / Девочки
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.activeTab = Number(e.target.dataset.gender);
        render();
    });
});

// МОДАЛКА УЧАСТНИКА: Сохранение данных
document.getElementById('edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Number(document.getElementById('edit-id').value);
    const player = state.participants.find(p => p.id === id);
    if (!player) return;
    
    player.name = document.getElementById('edit-name').value;
    player.age = Number(document.getElementById('edit-age').value);
    player.weight = Number(document.getElementById('edit-weight').value);
    player.city = document.getElementById('edit-city').value;
    player.club = document.getElementById('edit-club').value;
    player.kyu = Number(document.getElementById('edit-kyu').value);

    document.getElementById('edit-modal').classList.add('hidden');
    render();
});
document.getElementById('close-edit-modal')?.addEventListener('click', () => {
    document.getElementById('edit-modal').classList.add('hidden');
});


// МОДАЛКА ГРУППЫ: Создание и Изменение параметров
const groupModal = document.getElementById('group-modal');
const groupForm = document.getElementById('group-form');

document.getElementById('btn-create-group')?.addEventListener('click', () => {
    groupForm.reset();
    document.getElementById('group-edit-id').value = '';
    document.getElementById('group-modal-title').innerText = 'Создание группы';
    
    // Скрываем блок управления сеткой для новых групп
    document.getElementById('group-bracket-management').classList.add('hidden');
    
    // ... (остальные ваши дефолтные параметры) ...
    groupModal.classList.remove('hidden');
});

// Кнопка закрытия модалки группы
document.getElementById('close-group-modal')?.addEventListener('click', () => {
    groupModal.classList.add('hidden');
});

// Отправка формы группы (Создание ИЛИ Обновление)
groupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('group-edit-id').value;
    
    let nameInput = document.getElementById('group-name').value.trim();
    const minAge = Number(document.getElementById('group-min-age').value);
    const maxAge = Number(document.getElementById('group-max-age').value);
    const minWeight = parseFloat(document.getElementById('group-min-weight').value);
    const maxWeight = parseFloat(document.getElementById('group-max-weight').value);
    const minKyu = Number(document.getElementById('group-min-kyu').value);
    const maxKyu = Number(document.getElementById('group-max-kyu').value);

    // 1. АВТОМАТИЧЕСКОЕ ИМЕНОВАНИЕ (если поле пустое)
    if (!nameInput) {
        const genderText = state.activeTab === 1 ? 'Мальчики' : 'Девочки';
        nameInput = `${genderText} ${minAge}-${maxAge} лет, ${minWeight}-${maxWeight} кг, ${minKyu}-${maxKyu} кю`;
        
        // 2. ПРОВЕРКА НА ДУБЛИКАТЫ (добавление индекса (2), (3) и т.д.)
        let finalName = nameInput;
        let counter = 2;
        
        // Проверяем, есть ли уже группы с таким именем (исключая редактируемую)
        while (state.groups.some(g => g.id !== editId && g.name === finalName)) {
            finalName = `${nameInput} (${counter})`;
            counter++;
        }
        nameInput = finalName;
    }

    const groupData = {
        name: nameInput,
        minAge,
        maxAge,
        minWeight,
        maxWeight,
        minKyu,
        maxKyu,
    };

    if (editId) {
        // РЕДАКТИРОВАНИЕ СУЩЕСТВУЮЩЕЙ ГРУППЫ
        const targetGroup = state.groups.find(g => g.id === editId);
        if (targetGroup) {
            Object.assign(targetGroup, groupData);
        }
    } else {
        // СОЗДАНИЕ НОВОЙ ГРУППЫ
        state.groups.push({
            id: `group_${Date.now()}`,
            gender: state.activeTab,
            participantIds: [],
            ...groupData
        });
    }

    groupModal.classList.add('hidden');
    render();
});

// ГЛОБАЛЬНЫЕ КАСТОМНЫЕ СОБЫТИЯ ДЛЯ КНОПОК ИЗ RENDER.JS
window.addEventListener('edit-group', (e) => {
    const groupId = e.detail;
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    document.getElementById('group-edit-id').value = group.id;
    document.getElementById('group-modal-title').innerText = 'Редактирование группы';
    
    document.getElementById('group-name').value = group.name;
    document.getElementById('group-min-age').value = group.minAge;
    document.getElementById('group-max-age').value = group.maxAge;
    document.getElementById('group-min-weight').value = group.minWeight;
    document.getElementById('group-max-weight').value = group.maxWeight;
    document.getElementById('group-min-kyu').value = group.minKyu;
    document.getElementById('group-max-kyu').value = group.maxKyu;

    // Включаем правую панель управления сеткой внутри модалки
    const bracketManagementBlock = document.getElementById('group-bracket-management');
    bracketManagementBlock.classList.remove('hidden');

    // Отрисовываем сетку группы в превью-контейнер
    drawBracketToContainer(group, 'group-bracket-preview');

    // Перевешиваем клик на кнопку "Сгенерировать/Сбросить сетку"
    const btnGen = document.getElementById('btn-generate-tree');
    const newBtnGen = btnGen.cloneNode(true);
    btnGen.parentNode.replaceChild(newBtnGen, btnGen);
    
    newBtnGen.addEventListener('click', () => {
        generateBracketForGroup(group);
        drawBracketToContainer(group, 'group-bracket-preview');
    });

    groupModal.classList.remove('hidden');
});

window.addEventListener('delete-group', (e) => {
    const groupId = e.detail;
    const targetGroup = state.groups.find(g => g.id === groupId);
    if (!targetGroup) return;

    if (confirm(`Вы уверены, что хотите удалить группу "${targetGroup.name}"? Участники вернутся в неопределенные.`)) {
        const unassignedGroup = state.groups.find(g => g.id === 'unassigned');
        
        // Переносим всех участников удаляемой группы обратно в неопределенные
        unassignedGroup.participantIds.push(...targetGroup.participantIds);
        
        // Удаляем группу из массива
        state.groups = state.groups.filter(g => g.id !== groupId);
        
        render();
    }
});


// Управление модалкой сеток
document.getElementById('btn-show-brackets')?.addEventListener('click', () => {
    state.currentBracketGroupIndex = 0;
    renderBrackets();
    document.getElementById('brackets-modal').classList.remove('hidden');
});
document.getElementById('close-brackets-modal')?.addEventListener('click', () => {
    document.getElementById('brackets-modal').classList.add('hidden');
    render();
});
document.getElementById('prev-bracket-group')?.addEventListener('click', () => {
    if (state.currentBracketGroupIndex > 0) { state.currentBracketGroupIndex--; renderBrackets(); }
});
document.getElementById('next-bracket-group')?.addEventListener('click', () => {
    const filteredGroups = state.groups.filter(g => g.isUnassigned || g.gender === state.activeTab);
    if (state.currentBracketGroupIndex < filteredGroups.length - 1) { state.currentBracketGroupIndex++; renderBrackets(); }
});

document.getElementById('btn-strict-split')?.addEventListener('click', () => {
    const isUpdated = runStrictSplit();
    if (isUpdated) render(); 
});

document.getElementById('btn-smart-fill')?.addEventListener('click', () => {
    const isUpdated = runSmartFill();
    if (isUpdated) render();
});

document.getElementById('btn-export')?.addEventListener('click', () => {
    exportToExcel();
});

// --- ЗАПУСК ПРИЛОЖЕНИЯ ---
initExcel();
render();