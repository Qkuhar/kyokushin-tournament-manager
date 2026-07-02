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

// ГЛАВНЫЙ АДАПТИВНЫЙ ИМПОРТ (СЦЕНАРИИ 1, 2, 3, 4)
function handleExcelFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 1. УРОВЕНЬ 1: Лист участников обязателен всегда
        const participantsSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'participants');
        if (!participantsSheetName) {
            alert('Ошибка: В Excel файле не найден обязательный лист "participants"!');
            return;
        }

        const participantsData = XLSX.utils.sheet_to_json(workbook.Sheets[participantsSheetName]);
        if (participantsData.length === 0) {
            alert('Лист "participants" пуст.');
            return;
        }

        // ПРОВЕРКА УРОВНЯ 2: Лист групп
        const groupsSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'groups');
        const groupsData = groupsSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[groupsSheetName]) : null;

        // Если листа groups нет — это СЦЕНАРИЙ 1 (Простая заливка участников)
        if (!groupsData) {
            processImportData(participantsData);
            return;
        }

        // ЕСЛИ ЕСТЬ ГРУППЫ — ПОЛНОЕ ВОССТАНОВЛЕНИЕ ТУРНИРА (СЦЕНАРИИ 2, 3, 4)
        state.participants = [];
        
        const unassignedGroup = { id: 'unassigned', name: 'Неопределенные', isUnassigned: true, participantIds: [] };
        state.groups = [unassignedGroup];

        // Восстанавливаем общую базу участников
        participantsData.forEach(p => {
            state.participants.push({
                id: Number(p["id"]),
                name: String(p["ФИО"]).trim(),
                gender: Number(p["Пол"]),
                age: Number(p["Возраст"]),
                weight: parseFloat(String(p["Вес"])),
                city: p["Город"] || "Неизвестно",
                club: p["Клуб (Тренер)"] || "Самостоятельно",
                kyu: Number(p["Кю (Пояс)"])
            });
        });

        // Восстанавливаем Регламентные Группы (Уровень 2)
        groupsData.forEach(g => {
            if (g["id"] === 'unassigned') return;

            const groupObj = {
                id: String(g["id"]), // Сохраняем оригинальный ID группы
                name: g["name"],
                gender: Number(g["Пол"]),
                minAge: g["Возраст min"] ?? 0,
                maxAge: g["Возраст max"] ?? 100,
                minWeight: g["Вес min"] ?? 0,
                maxWeight: g["Вес max"] ?? 500,
                minKyu: g["Кю min"] ?? 1,
                maxKyu: g["Кю max"] ?? 10,
                participantIds: [],
                bracketMatches: null
            };

            // ИЩЕМ ЛИСТ: Сначала по ID группы, если не нашли — по сгенерированному имени листа (для совместимости)
            let groupSheet = workbook.Sheets[groupObj.id];
            if (!groupSheet) {
                // Фоллбек: ищем лист, у которого в метаданных (ячейка B3 / строка 3) совпадает ID группы
                const sheetName = workbook.SheetNames.find(name => {
                    const s = workbook.Sheets[name];
                    if (!s) return false;
                    const rows = XLSX.utils.sheet_to_json(s, { header: 1 });
                    return rows[2] && String(rows[2][1]).trim() === groupObj.id;
                });
                if (sheetName) groupSheet = workbook.Sheets[sheetName];
            }

            // УРОВЕНЬ 3 и 4: Парсим погрупповой лист, если он существует
            if (groupSheet) {
                const sheetRows = XLSX.utils.sheet_to_json(groupSheet, { header: 1 });
                let currentMode = 'metadata';
                let colIdxId = 1; // По умолчанию второй столбец (индекс 1)

                sheetRows.forEach(row => {
                    if (!row || row.length === 0) return;
                    const firstCell = row[0] ? String(row[0]).trim() : "";

                    if (firstCell.includes("СПИСОК УЧАСТНИКОВ")) { currentMode = 'players_header'; return; }
                    if (firstCell.includes("ТУРНИРНАЯ СЕТКА")) { currentMode = 'bracket_header'; return; }

                    if (currentMode === 'players_header' && firstCell === "Позиция") {
                        currentMode = 'players_body';
                        const foundIdx = row.findIndex(cell => String(cell).trim().toLowerCase().includes("id"));
                        if (foundIdx !== -1) colIdxId = foundIdx;
                        return;
                    }
                    if (currentMode === 'bracket_header' && firstCell === "Номер боя") { currentMode = 'bracket_body'; return; }

                    // УРОВЕНЬ 3: Восстановление участников в группу по ID
                    if (currentMode === 'players_body') {
                        const playerIdRaw = row[colIdxId];
                        if (playerIdRaw !== undefined && playerIdRaw !== null && String(playerIdRaw).trim() !== "") {
                            const pId = Number(playerIdRaw);
                            if (state.participants.some(p => p.id === pId)) {
                                groupObj.participantIds.push(pId);
                            }
                        }
                    }

                    // УРОВЕНЬ 4: Импорт пустой сформированной сетки
                    if (currentMode === 'bracket_body') {
                        if (!groupObj.bracketMatches) {
                            groupObj.bracketMatches = { type: 'olympic', matches: [] };
                        }
                        
                        // Забираем ID боя (вырезаем цифры из "Бой №X")
                        const matchId = Number(String(row[0]).replace(/\D/g, ''));
                        const round = row[1];
                        
                        const p1Name = row[2] ? String(row[2]).trim() : "";
                        const p1 = row[3] === '' ? null : Number(row[3]);
                        
                        const p2Name = row[4] ? String(row[4]).trim() : "";
                        const p2 = row[5] === '' ? null : Number(row[5]);

                        // Пишем чистый объект без фантомных полей. Winner всегда null!
                        groupObj.bracketMatches.matches.push({
                            id: matchId,
                            round: round,
                            p1: p1,
                            p2: p2,
                            winner: null,
                            isByeMatch: false
                        });
                    }
                });
                console.log(groupObj);

                // АВТОМАТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ ТЕХНИЧЕСКИХ МАТЧЕЙ (BYE)
                if (groupObj.bracketMatches && groupObj.bracketMatches.matches.length > 0) {
                    const currentMatches = groupObj.bracketMatches.matches;
                    const maxMatchId = Math.max(...currentMatches.map(m => m.id));
                    
                    const totalMatches = maxMatchId; 
                    const fullMatchesArray = [];

                    // 1. Сначала заполняем массив тем, что пришло из Excel
                    for (let i = 1; i <= totalMatches; i++) {
                        const found = currentMatches.find(m => m.id === i);
                        if (found) {
                            fullMatchesArray.push(found);
                        } else {
                            const len = totalMatches; 
                            const parentId = Math.floor(len / 2) + Math.floor((i+1) / 2);
                            
                            // console.log(parentId, len, i);
                            const parent = currentMatches.find(m => m.id === parentId);

                            console.log(parent);
                            fullMatchesArray.push({
                                id: i,
                                round: `1/${len / 2} Финала`, // Пример именования
                                p1: i % 2 ? parent.p1 : parent.p2,
                                p2: null,
                                winner: i % 2 ? parent.p1 : parent.p2,
                                isByeMatch: true
                            });
                        }
                    }

                    groupObj.bracketMatches.matches = fullMatchesArray.sort((a, b) => a.id - b.id);
                }
                console.log(groupObj);
            }
            
            state.groups.push(groupObj);
        });

        // НАКОПИТЕЛЬНЫЙ АВТО-УМНОЖИТЕЛЬ ДЛЯ ОСТАТКОВ
        state.participants.forEach(p => {
            const isInAnyGroup = state.groups.some(g => !g.isUnassigned && g.participantIds.includes(p.id));
            if (!isInAnyGroup) {
                unassignedGroup.participantIds.push(p.id);
            }
        });

        alert('Все данные турнира, группы и хронология боев успешно восстановлены!');
        render();
    };
    reader.readAsArrayBuffer(file);
}

// СЦЕНАРИЙ 1 И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (БЕЗ ИЗМЕНЕНИЙ)
function processImportData(rows) {
    const collisions = []; const clearRows = [];
    rows.forEach(row => {
        const name = (row["ФИО"] || "").trim();
        if (!name) return;
        const isDuplicate = state.participants.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (isDuplicate) collisions.push(row); else clearRows.push(row);
    });
    if (collisions.length === 0) {
        insertPlayersToState(clearRows); alert(`Успешно загружено участников: ${clearRows.length}`); render(); return;
    }
    showCollisionModal(collisions, clearRows);
}

function showCollisionModal(collisions, clearRows) {
    const modal = document.getElementById('collision-modal');
    const listContainer = document.getElementById('collision-list');
    listContainer.innerHTML = collisions.map(c => `<div>• ${c["ФИО"]}</div>`).join('');
    modal.classList.remove('hidden');
    const btnRename = document.getElementById('btn-collision-rename');
    const btnMerge = document.getElementById('btn-collision-merge');
    const btnCancel = document.getElementById('btn-collision-cancel');
    const newRename = btnRename.cloneNode(true); const newMerge = btnMerge.cloneNode(true); const newCancel = btnCancel.cloneNode(true);
    btnRename.parentNode.replaceChild(newRename, btnRename); btnMerge.parentNode.replaceChild(newMerge, btnMerge); btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newRename.addEventListener('click', () => {
        collisions.forEach(row => {
            let baseName = row["ФИО"].trim(); let finalName = baseName; let counter = 2;
            while (state.participants.some(p => p.name.toLowerCase() === finalName.toLowerCase())) { finalName = `${baseName} (${counter})`; counter++; }
            row["ФИО"] = finalName;
        });
        insertPlayersToState([...clearRows, ...collisions]); modal.classList.add('hidden'); render();
    });
    newMerge.addEventListener('click', () => { insertPlayersToState(clearRows); modal.classList.add('hidden'); render(); });
    newCancel.addEventListener('click', () => { modal.classList.add('hidden'); document.getElementById('file-input').value = ''; });
}

function insertPlayersToState(rowsList) {
    let unassignedGroup = state.groups.find(g => g.id === 'unassigned');
    if (!unassignedGroup) {
        unassignedGroup = { id: 'unassigned', name: 'Неопределенные', isUnassigned: true, participantIds: [] };
        state.groups.push(unassignedGroup);
    }
    rowsList.forEach(row => {
        const maxId = state.participants.reduce((max, p) => p.id > max ? p.id : max, 0);
        const newId = maxId + 1;
        state.participants.push({
            id: newId, name: (row["ФИО"] || `Участник ${newId}`).trim(), gender: Number(row["Пол"]) || 1,
            age: Number(row["Возраст"]) || 10, weight: parseFloat(String(row["Вес"]).replace(',', '.')) || 40.0,
            city: row["Город"] || "Неизвестно", club: row["Клуб (Тренер)"] || row["Клуб"] || "Самостоятельно", kyu: Number(row["Кю (Пояс)"]) || 9
        });
        unassignedGroup.participantIds.push(newId);
    });
}

// ИСПРАВЛЕННЫЙ ЭКСПОРТ (НЕ ЗАТИРАЕТ ID ГРУППЫ)
export function exportToExcel() {
    if (state.participants.length === 0) { alert("Нет данных для экспорта!"); return; }
    const workbook = XLSX.utils.book_new();
    
    // 1. Лист участников
    const participantsData = state.participants.map(p => ({
        "id": p.id, "ФИО": p.name, "Пол": p.gender, "Возраст": p.age, "Вес": p.weight, "Город": p.city, "Клуб (Тренер)": p.club, "Кю (Пояс)": p.kyu
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(participantsData), "participants");

    // 2. Лист групп
    const realGroups = state.groups.filter(g => !g.isUnassigned);
    const groupsData = realGroups.map(g => ({
        "id": g.id, "name": g.name, "Пол": g.gender, "Возраст min": g.minAge ?? 0, "Возраст max": g.maxAge ?? 100, "Вес min": g.minWeight ?? 0, "Вес max": g.maxWeight ?? 500, "Кю min": g.minKyu ?? 1, "Кю max": g.maxKyu ?? 10
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groupsData), "groups");

    const usedSheetNames = {};

    realGroups.forEach(group => {
        const groupPlayers = (group.participantIds || []).map(id => state.participants.find(p => p.id === id)).filter(Boolean);
        
        let prefix = group.gender === 1 ? 'm_' : (group.gender === 2 ? 'g_' : 'b_');
        let baseSheetName = `${prefix}${group.minAge ?? 0}-${group.maxAge ?? 0}y_${group.minWeight ?? 0}-${group.maxWeight ?? 0}kg`.substring(0, 31);
        let finalSheetName = baseSheetName;

        if (usedSheetNames[baseSheetName]) {
            usedSheetNames[baseSheetName]++;
            finalSheetName = baseSheetName.substring(0, 25) + ` (${usedSheetNames[baseSheetName]})`;
        } else { usedSheetNames[baseSheetName] = 1; }

        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Мы НЕ меняем group.id! Мы просто используем finalSheetName для создания вкладки Excel
        const rows = [
            ["ПАРАМЕТРЫ ГРУППЫ"], 
            ["Имя группы:", group.name], 
            ["ID / Имя листа:", group.id], // Здесь пишется оригинальный ID, импорт найдет его в строке 3 ячейке B3!
            ["Пол участников:", group.gender === 1 ? "Мальчики" : "Девочки"],
            ["Возраст:", `от ${group.minAge} до ${group.maxAge} лет`], 
            ["Вес:", `от ${group.minWeight} до ${group.maxWeight} кг`],
            ["Кю (Пояс):", `от ${group.minKyu ?? 1} до ${group.maxKyu ?? 10} кю`], [],
            ["СПИСОК УЧАСТНИКОВ"], 
            ["Позиция", "ID участника", "ФИО участника", "Клуб (Тренер)", "Город", "Вес (кг)", "Возраст", "Кю"]
        ];

        groupPlayers.forEach((p, idx) => {
            rows.push([idx + 1, p.id, p.name, p.club, p.city, p.weight, p.age, p.kyu]);
        });

        const bm = group.bracketMatches;
        if (bm && bm.matches && bm.matches.length > 0) {
            rows.push([], ["ТУРНИРНАЯ СЕТКА И ХРОНОЛОГИЯ БОЕВ"], ["Номер боя", "Этап турнира", "Боец 1", "Боец 1 id", "Боец 2", "Боец 2 id", "Результат (Победитель)"]);
            
            const totalMatches = bm.matches.length;

            bm.matches.forEach((match, index) => {
                if (match.isByeMatch) return;

                const p1 = groupPlayers.find(p => p.id === match.p1);
                const p2 = groupPlayers.find(p => p.id === match.p2);
                const win = groupPlayers.find(p => p.id === match.winner);

                let p1T = "—";
                let p2T = "—";

                if (p1) {
                    p1T = p1.name;
                } else {
                    // Если это бой За 3-е место
                    if (match.round === 'За 3-е место' || match.round?.toLowerCase().includes("3")) {
                        // Индекс финала — это индекс текущего боя минус 1
                        const finalIndex = index - 1;
                        // Вычисляем индексы двух полуфиналов, которые вели к этому финалу
                        const semi1Idx = Math.floor((finalIndex - totalMatches / 2) * 2);
                        const semi1 = bm.matches[semi1Idx];
                        
                        p1T = semi1 ? `Проигравший боя №${semi1.id}` : "—";
                    } else {
                        // Обычный олимпийский раунд
                        const prevMatch1Idx = Math.floor((index - totalMatches / 2) * 2);
                        const prevMatch1 = bm.matches[prevMatch1Idx];
                        if (prevMatch1) {
                            p1T = prevMatch1.isByeMatch && prevMatch1.p1 
                                ? (groupPlayers.find(p => p.id === prevMatch1.p1)?.name || "—")
                                : `Победитель боя №${prevMatch1.id}`;
                        }
                    }
                }

                if (p2) {
                    p2T = p2.name;
                } else {
                    // Если это бой За 3-е место
                    if (match.round === 'За 3-е место' || match.round?.toLowerCase().includes("3")) {
                        const finalIndex = index - 1;
                        const semi2Idx = Math.floor(((finalIndex - totalMatches / 2) * 2) + 1);
                        const semi2 = bm.matches[semi2Idx];
                        
                        p2T = semi2 ? `Проигравший боя №${semi2.id}` : "—";
                    } else {
                        // Обычный олимпийский раунд
                        const prevMatch2Idx = Math.floor(((index - totalMatches / 2) * 2) + 1);
                        const prevMatch2 = bm.matches[prevMatch2Idx];
                        if (prevMatch2) {
                            p2T = prevMatch2.isByeMatch && prevMatch2.p1 
                                ? (groupPlayers.find(p => p.id === prevMatch2.p1)?.name || "—")
                                : `Победитель боя №${prevMatch2.id}`;
                        }
                    }
                }

                rows.push([
                    `Бой №${match.id}`, 
                    match.round, 
                    p1T, 
                    match.p1 || "", // Скрытый ID 1
                    p2T, 
                    match.p2 || "", // Скрытый ID 2
                    "—"
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = Array(8).fill({ wch: 22 });
        XLSX.utils.book_append_sheet(workbook, ws, finalSheetName);
    });

    XLSX.writeFile(workbook, `tournament_complete_backups_${Date.now()}.xlsx`);
}