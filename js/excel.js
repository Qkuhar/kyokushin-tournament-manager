import { state } from './state.js';
import { render } from './render.js';

export function initExcel() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleExcelFile(e.target.files[0]));

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = '#cbd5e1');
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';
        if (e.dataTransfer.files.length > 0) handleExcelFile(e.dataTransfer.files[0]);
    });
}

function handleExcelFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'participants');
        
        if (!sheetName) {
            alert('Ошибка: В Excel файле не найден лист с именем "participants"!');
            return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
            alert('Лист "participants" пуст.');
            return;
        }

        processImportData(jsonData);
    };
    reader.readAsArrayBuffer(file);
}

// Главный конвейер обработки импорта и коллизий
function processImportData(rows) {
    const collisions = [];
    const clearRows = [];

    // Разделяем входящие строки на чистые данные и дубликаты
    rows.forEach(row => {
        const name = (row["ФИО"] || "").trim();
        if (!name) return;

        // Ищем, есть ли уже такое ФИО в системе (регистронезависимо)
        const isDuplicate = state.participants.some(p => p.name.toLowerCase() === name.toLowerCase());

        if (isDuplicate) {
            collisions.push(row);
        } else {
            clearRows.push(row);
        }
    });

    // Если дубликатов нет — просто загружаем данные
    if (collisions.length === 0) {
        insertPlayersToState(clearRows);
        alert(`Успешно загружено участников: ${clearRows.length}`);
        render();
        return;
    }

    // Если дубликаты обнаружены, открываем кастомное окно решений
    showCollisionModal(collisions, clearRows);
}

// Функция отрисовки окна коллизий
function showCollisionModal(collisions, clearRows) {
    const modal = document.getElementById('collision-modal');
    const listContainer = document.getElementById('collision-list');
    
    // Выводим список дубликатов, чтобы пользователь видел, о ком речь
    listContainer.innerHTML = collisions.map(c => {
        return `<div style="font-size: 0.85rem; color: #991b1b; font-weight: 600;">
            • ${c["ФИО"]} (${c["Клуб"]} / ${c["Город"]} / ${c["Вес"]} кг)
        </div>`;
    }).join('');

    modal.classList.remove('hidden');

    // Клонируем кнопки, чтобы удалить старые слушатели событий (вечный баг дублирования кликов)
    const btnRename = document.getElementById('btn-collision-rename');
    const btnMerge = document.getElementById('btn-collision-merge');
    const btnCancel = document.getElementById('btn-collision-cancel');

    const newRename = btnRename.cloneNode(true);
    const newMerge = btnMerge.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);

    btnRename.parentNode.replaceChild(newRename, btnRename);
    btnMerge.parentNode.replaceChild(newMerge, btnMerge);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    // ВАРИАНТ 1: Добавить всех как новых участников (с суффиксами ФИО (2))
    newRename.addEventListener('click', () => {
        collisions.forEach(row => {
            let baseName = row["ФИО"].trim();
            let finalName = baseName;
            let counter = 2;

            // Генерируем уникальное имя вида "Иванов Иван (2)"
            while (state.participants.some(p => p.name.toLowerCase() === finalName.toLowerCase())) {
                finalName = `${baseName} (${counter})`;
                counter++;
            }
            row["ФИО"] = finalName; // Подменяем имя на уникальное
        });

        // Импортируем и чистые, и переименованные коллизии
        insertPlayersToState([...clearRows, ...collisions]);
        modal.classList.add('hidden');
        alert(`Импорт завершен. Созданы новые профили для дубликатов с числовыми индексами.`);
        render();
    });

    // ВАРИАНТ 2: Это одни и те же люди (пропускаем дубликаты, берем только уникальных)
    newMerge.addEventListener('click', () => {
        if (clearRows.length > 0) {
            insertPlayersToState(clearRows);
            alert(`Импортировано только новых участников: ${clearRows.length}. Дубликаты пропущены.`);
        } else {
            alert('Все участники в файле являлись дубликатами. Никто не добавлен.');
        }
        modal.classList.add('hidden');
        render();
    });

    // ВАРИАНТ 3: Полная отмена операции
    newCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
        document.getElementById('file-input').value = ''; // Сбрасываем инпут
        alert('Импорт файла полностью отменен.');
    });
}

// Вспомогательная функция добавления сырых строк Excel в стейт менеджера
function insertPlayersToState(rowsList) {
    const unassignedGroup = state.groups.find(g => g.id === 'unassigned');
    
    rowsList.forEach(row => {
        const newId = state.participants.length + 1;
        state.participants.push({
            id: newId,
            name: (row["ФИО"] || `Участник ${newId}`).trim(),
            gender: Number(row["Пол"]) || 1,
            age: Number(row["Возраст"]) || 10,
            weight: parseFloat(String(row["Вес"]).replace(',', '.')) || 40.0,
            city: row["Город"] || "Неизвестно",
            club: row["Клуб (Тренер)"] || row["Клуб"] || "Самостоятельно",
            kyu: Number(row["Кю (Пояс)"]) || 9
        });
        
        // Отправляем ID в список неопределенных
        unassignedGroup.participantIds.push(newId);
    });
}

// Функция экспорта данных в Excel
export function exportToExcel() {
    if (state.participants.length === 0) {
        alert("Нет данных для экспорта!");
        return;
    }

    // 1. Формируем массив объектов для листа 'participants'
    const participantsData = state.participants.map(p => ({
        "id": p.id,
        "ФИО": p.name,
        "Пол": p.gender, // 1 - Мальчики, 2 - Девочки
        "Возраст": p.age,
        "Вес": p.weight,
        "Город": p.city,
        "Клуб (Тренер)": p.club,
        "Кю (Пояс)": p.kyu
    }));

    // 2. Формируем массив объектов для листа 'groups'
    // Исключаем системную группу "Неопределенные", берем только регламентные
    const realGroups = state.groups.filter(g => !g.isUnassigned);
    const groupsData = realGroups.map(g => ({
        "id": g.id,
        "name": g.name,
        "Пол": g.gender,
        "Возраст min": g.minAge ?? 0,
        "Возраст max": g.maxAge ?? 100,
        "Вес min": g.minWeight ?? 0,
        "Вес max": g.maxWeight ?? 500
    }));

    // 3. Создаем пустую книгу Excel
    const workbook = XLSX.utils.book_new();

    // 4. Генерируем листы из наших массивов данных
    const worksheetParticipants = XLSX.utils.json_to_sheet(participantsData);
    const worksheetGroups = XLSX.utils.json_to_sheet(groupsData);

    // 5. Добавляем листы в книгу с правильными именами
    XLSX.utils.book_append_sheet(workbook, worksheetParticipants, "participants");
    XLSX.utils.book_append_sheet(workbook, worksheetGroups, "groups");

    // 6. Генерируем файл и запускаем скачивание в браузере
    XLSX.writeFile(workbook, `tournament_data_${Date.now()}.xlsx`);
}