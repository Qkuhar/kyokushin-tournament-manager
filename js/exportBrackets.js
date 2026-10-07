import { state } from './state.js';

/**
 * Загрузка изображения эмблемы (favicon.ico из корня проекта)
 */
function loadLogo() {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = './favicon.ico';
    });
}

/**
 * Подсчет реального количества боев в группе
 */
function getMatchesCount(group) {
    const n = group.participantIds?.length || 0;
    if (n === 3) {
        return 3; // Для 3 участников всегда 3 боя по кругу
    }
    if (group.bracketMatches && group.bracketMatches.matches) {
        return group.bracketMatches.matches.filter(m => !m.isByeMatch).length;
    }
    return n <= 2 ? 1 : 0;
}

/**
 * Экспорт ВСЕХ сеток в один многостраничный вертикальный (Portrait) PDF
 */
export async function exportBracketToPDF() {
    const allActiveGroups = state.groups.filter(g => !g.isUnassigned && g.bracketMatches);
    
    if (allActiveGroups.length === 0) {
        alert("Нет сформированных сеток для экспорта.");
        return;
    }

    const logoImg = await loadLogo();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const canvasW = 2480;
    const canvasH = 3508;

    for (let index = 0; index < allActiveGroups.length; index++) {
        const group = allActiveGroups[index];
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        // Белый фон
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 1. Прямоугольник в правом верхнем углу
        drawTopRightBox(ctx, canvasW);

        const startX = 80;
        const totalW = canvasW - 160;

        const participantCount = group.participantIds?.length || 0;
        
        // СТРОГОЕ УСЛОВИЕ: Только если 3 человека — круговая! Во всех остальных случаях — олимпийская
        const isRoundRobin = (participantCount === 3);

        if (isRoundRobin) {
            // === КРУГОВАЯ СИСТЕМА (Ровно 3 человека) ===
            drawRoundRobinHeader(ctx, group, canvasW);

            const logoSize = canvasW / 4; // 620px
            const logoY = 210;

            if (logoImg) {
                const logoX = canvasW - startX - logoSize;
                ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
            }

            const tableStartY = logoY + logoSize + 40;
            const tableH = drawRoundRobinTable(ctx, group, state.participants, startX, tableStartY, totalW);

            const prizeStartY = tableStartY + tableH + 80;
            drawPrizeTableAt(ctx, canvasW, prizeStartY);

        } else {
            // === ОЛИМПИЙСКАЯ СИСТЕМА (Все остальные варианты: 2, 4, 8, 16...) ===
            drawHeader(ctx, group, canvasW);

            const startY = 300;
            const totalH = canvasH * 0.68; 

            drawOlympicTreeFromMatches(ctx, group, state.participants, startX, startY, totalW, totalH, logoImg);

            // Таблица призеров снизу
            drawPrizeTableAt(ctx, canvasW, canvasH - 340);
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.80);
        
        if (index > 0) {
            pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    pdf.save(`Турнирные_Сетки_СММ_больших_и_маленьких_побед_2026.pdf`);
}

/**
 * Прямоугольник в правом верхнем углу страницы
 */
function drawTopRightBox(ctx, canvasWidth) {
    const boxW = 200;
    const boxH = 90;
    const x = canvasWidth - boxW - 80;
    const y = 50;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, boxW, boxH);
}

/**
 * Шапка для Круговой системы
 */
function drawRoundRobinHeader(ctx, group, canvasWidth) {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    ctx.font = 'bold 46px Arial';
    ctx.fillText("СММ больших и маленьких побед 2026", canvasWidth / 2 - 50, 110);

    const genderText = group.gender === 'male' ? 'мальчики' : (group.gender === 'female' ? 'девочки' : 'участники');
    const ageText = group.ageCategory || group.age || group.ageName || '';
    const weightText = group.weightCategory || group.weight || group.weightName || '';
    const groupNameText = group.name || '';

    const matchCount = getMatchesCount(group);
    const participantCount = group.participantIds?.length || 0;
    const cupsCount = Math.min(3, participantCount);

    const subtitleParts = [
        genderText, 
        ageText, 
        weightText, 
        groupNameText,
        `Боев: ${matchCount}`//,
        //`Кубков: ${cupsCount}`
    ].filter(Boolean);

    ctx.font = 'bold 30px Arial';
    ctx.fillText(subtitleParts.join(' | '), canvasWidth / 2 - 50, 175);
}

/**
 * Стандартная шапка
 */
function drawHeader(ctx, group, canvasWidth) {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    ctx.font = 'bold 50px Arial';
    ctx.fillText("СММ больших и маленьких побед 2026", canvasWidth / 2 - 50, 110);

    const genderText = group.gender === 'male' ? 'мальчики' : (group.gender === 'female' ? 'девочки' : 'участники');
    const ageText = group.ageCategory || group.age || group.ageName || '';
    const weightText = group.weightCategory || group.weight || group.weightName || '';
    const groupNameText = group.name || '';

    const matchCount = getMatchesCount(group);
    const participantCount = group.participantIds?.length || 0;
    const cupsCount = Math.min(3, participantCount);

    const subtitleParts = [
        genderText, 
        ageText, 
        weightText, 
        groupNameText,
        `Боев: ${matchCount}`//,
        //`Кубков: ${cupsCount}`
    ].filter(Boolean);

    ctx.font = 'bold 32px Arial';
    ctx.fillText(subtitleParts.join(' | '), canvasWidth / 2 - 50, 175);
}

/**
 * Мета-информация участника
 */
function getPlayerMetaText(p) {
    if (!p) return '';
    // const age = p.age ? `${p.age} лет` : '';
    // const rank = p.kyu || p.rank || p.dan ? `${p.kyu || p.rank} кю` : '';
    // const weight = p.weight ? `${p.weight} кг` : '';
    const city = p.city ? `${p.city}` : '';
    const club = p.club ? `${p.club}` : '';
    
    // return [age, rank, weight].filter(Boolean).join(' ');
    return [city, club].filter(Boolean).join(' ');
}

/**
 * Таблица круговой системы
 */
function drawRoundRobinTable(ctx, group, allParticipants, startX, startY, totalW) {
    const players = group.participantIds
        .map(id => allParticipants.find(p => p.id === id))
        .filter(Boolean);

    const numPlayers = players.length;
    if (numPlayers === 0) return 0;

    const nameColW = 650;
    const gridW = totalW - nameColW;
    const colW = gridW / numPlayers;
    const headerH = 90;
    const rowH = 170;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;

    const tableH = headerH + rowH * numPlayers;
    ctx.strokeRect(startX, startY, totalW, tableH);

    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Бой №", startX + nameColW / 2, startY + headerH / 2);

    ctx.beginPath();
    ctx.moveTo(startX, startY + headerH);
    ctx.lineTo(startX + totalW, startY + headerH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX + nameColW, startY);
    ctx.lineTo(startX + nameColW, startY + tableH);
    ctx.stroke();

    for (let i = 0; i < numPlayers; i++) {
        const x = startX + nameColW + i * colW;
        if (i > 0) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, startY + tableH);
            ctx.stroke();
        }
    }

    players.forEach((p, idx) => {
        const y = startY + headerH + idx * rowH;

        if (idx > 0) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(startX + totalW, y);
            ctx.stroke();
        }

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';

        ctx.font = 'bold 34px Arial';
        ctx.fillText(p.name, startX + nameColW / 2, y + 60);

        ctx.font = '26px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText(getPlayerMetaText(p), startX + nameColW / 2, y + 115);

        for (let j = 0; j < numPlayers; j++) {
            const cellX = startX + nameColW + j * colW;

            if (idx === j) {
                ctx.font = 'bold 54px Arial';
                ctx.fillStyle = '#000000';
                ctx.fillText("X", cellX + colW / 2, y + rowH / 2);
            }
        }
    });

    return tableH;
}

/**
 * Отрисовка призовой таблицы по ТОЧНОЙ координате Y
 */
function drawPrizeTableAt(ctx, canvasWidth, y) {
    const tableW = 1100;
    const tableH = 210;
    const x = (canvasWidth - tableW) / 2;

    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText("Призовые места", canvasWidth / 2, y - 18);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, tableW, tableH);

    const rowH = tableH / 3;
    const colNumW = 140;

    for (let i = 0; i < 3; i++) {
        const currentY = y + i * rowH;

        if (i > 0) {
            ctx.beginPath();
            ctx.moveTo(x, currentY);
            ctx.lineTo(x + tableW, currentY);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(x + colNumW, currentY);
        ctx.lineTo(x + colNumW, currentY + rowH);
        ctx.stroke();

        ctx.font = 'bold 38px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, x + colNumW / 2, currentY + rowH / 2);
    }
}

/**
 * Олимпийская система (поддерживает любое количество участников != 3)
 */
function drawOlympicTreeFromMatches(ctx, group, players, startX, startY, totalW, totalH, logoImg) {
    const bm = group.bracketMatches;
    let matches = bm?.matches || [];

    const participantCount = group.participantIds?.length || 0;

    // Если всего 2 участника — сгенерировать 1 финал
    if (participantCount <= 2 && matches.length === 0) {
        matches = [{
            id: 'final_2p',
            p1: group.participantIds[0],
            p2: group.participantIds[1],
            round: 'Финал'
        }];
    }

    const isCompact = participantCount > 8;

    const allRoundsMap = {};
    matches.forEach(m => {
        if (m.round === 'За 3-е место') return;
        if (!allRoundsMap[m.round]) allRoundsMap[m.round] = [];
        allRoundsMap[m.round].push(m);
    });

    const visibleRoundsMap = {};
    matches.forEach(m => {
        if (m.isByeMatch || m.round === 'За 3-е место') return;
        if (!visibleRoundsMap[m.round]) visibleRoundsMap[m.round] = [];
        visibleRoundsMap[m.round].push(m);
    });

    const roundNames = Object.keys(visibleRoundsMap);
    const roundsCount = roundNames.length;
    if (roundsCount === 0) return;

    const totalCols = roundsCount + 1; 
    const colWidth = totalW / totalCols;
    const boxW = colWidth * 0.92; 
    const cellH = isCompact ? 85 : 170; 

    // Заголовки раундов
    roundNames.forEach((roundName, rIdx) => {
        const titleX = startX + rIdx * colWidth + colWidth / 2;
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(roundName, titleX, startY);
    });

    // Эмблема в колонке "Победитель"
    const winnerColX = startX + roundsCount * colWidth + colWidth / 2;
    if (logoImg) {
        const logoSize = colWidth * 0.90;
        const logoX = winnerColX - logoSize / 2;
        const logoY = startY - 40;
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    }

    const treeStartY = startY + 60;
    const matchCoords = {};

    const allRoundNames = Object.keys(allRoundsMap);
    const finalMatch = allRoundsMap[allRoundNames[allRoundNames.length - 1]][0];

    if (finalMatch) {
        positionMatchTreeProportional(
            finalMatch, 
            allRoundNames.length - 1, 
            treeStartY, 
            totalH, 
            allRoundsMap, 
            allRoundNames, 
            matchCoords, 
            startX, 
            colWidth, 
            boxW, 
            cellH,
            roundNames
        );
    }

    // 2. Карточки боёв
    roundNames.forEach((roundName) => {
        visibleRoundsMap[roundName].forEach((match) => {
            if (!matchCoords[match.id]) return;
            const mc = matchCoords[match.id];

            const p1 = players.find(p => p.id === match.p1);
            const p2 = players.find(p => p.id === match.p2);

            drawProportionalMatchTemplate(ctx, mc.x, mc.topSlotY, mc.bottomSlotY, boxW, cellH, match, p1, p2, null, isCompact);
        });
    });

    // 3. Соединительные линии
    for (let rIdx = 0; rIdx < roundNames.length; rIdx++) {
        const currentRoundName = roundNames[rIdx];
        const currentRoundMatches = visibleRoundsMap[currentRoundName];
        const nextRoundName = roundNames[rIdx + 1];

        currentRoundMatches.forEach((m) => {
            if (!matchCoords[m.id]) return;

            const curr = matchCoords[m.id];
            const xRight = curr.x + boxW;
            const y1 = curr.topCenterY;
            const y2 = curr.bottomCenterY;
            const bracketArm = (colWidth - boxW) / 2;
            const xBracket = xRight + bracketArm;
            const yMid = curr.centerY;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.beginPath();

            ctx.moveTo(xRight, y1); ctx.lineTo(xBracket, y1);
            ctx.moveTo(xRight, y2); ctx.lineTo(xBracket, y2);
            ctx.moveTo(xBracket, y1); ctx.lineTo(xBracket, y2);

            if (nextRoundName) {
                const parentMatchInAll = allRoundsMap[currentRoundName].find(item => item.id === m.id);
                const parentMatchIdx = allRoundsMap[currentRoundName].indexOf(parentMatchInAll);

                const nextMatchInAll = allRoundsMap[nextRoundName][Math.floor(parentMatchIdx / 2)];

                if (nextMatchInAll && matchCoords[nextMatchInAll.id]) {
                    const nextCoord = matchCoords[nextMatchInAll.id];
                    const isTopSlot = (parentMatchIdx % 2 === 0);
                    const targetSlotY = isTopSlot ? nextCoord.topCenterY : nextCoord.bottomCenterY;

                    ctx.moveTo(xBracket, yMid);
                    ctx.lineTo(nextCoord.x, targetSlotY);
                }
            }

            ctx.stroke();
        });
    }

    // 4. Победитель (1 место)
    if (finalMatch && matchCoords[finalMatch.id]) {
        const fCoord = matchCoords[finalMatch.id];
        const winnerX = startX + roundsCount * colWidth + (colWidth - boxW) / 2;
        const winnerY = fCoord.centerY - cellH / 2;

        const fBracketX = fCoord.x + boxW + (colWidth - boxW) / 2;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fCoord.x + boxW, fCoord.topCenterY); ctx.lineTo(fBracketX, fCoord.topCenterY);
        ctx.moveTo(fCoord.x + boxW, fCoord.bottomCenterY); ctx.lineTo(fBracketX, fCoord.bottomCenterY);
        ctx.moveTo(fBracketX, fCoord.topCenterY); ctx.lineTo(fBracketX, fCoord.bottomCenterY);
        ctx.moveTo(fBracketX, fCoord.centerY); ctx.lineTo(winnerX, fCoord.centerY);
        ctx.stroke();

        drawSingleWinnerSlot(ctx, winnerX, winnerY, boxW, cellH, "1 место", finalMatch, players, isCompact);
    }

    // 5. Бой за 3-е место (показываем только если участников > 2)
    const match3rd = matches.find(m => m.round === 'За 3-е место');
    if (match3rd && roundNames.length > 0 && participantCount > 2) {
        const lastRIdx = roundNames.length - 1;
        const x3rd = startX + lastRIdx * colWidth + (colWidth - boxW) / 2;
        
        const gapOffset = isCompact ? 30 : 50;
        const y3rdTop = treeStartY + totalH - (isCompact ? 280 : 420);
        const y3rdBottom = y3rdTop + cellH + gapOffset;
        const y3rdCenter = y3rdTop + (y3rdBottom + cellH - y3rdTop) / 2;

        const p1 = players.find(p => p.id === match3rd.p1);
        const p2 = players.find(p => p.id === match3rd.p2);

        drawProportionalMatchTemplate(ctx, x3rd, y3rdTop, y3rdBottom, boxW, cellH, match3rd, p1, p2, "Бой № _______", isCompact);

        // Победитель 3 место
        const winner3rdX = startX + roundsCount * colWidth + (colWidth - boxW) / 2;
        const winner3rdY = y3rdCenter - cellH / 2;

        const bracket3rdX = x3rd + boxW + (colWidth - boxW) / 2;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x3rd + boxW, y3rdTop + cellH / 2); ctx.lineTo(bracket3rdX, y3rdTop + cellH / 2);
        ctx.moveTo(x3rd + boxW, y3rdBottom + cellH / 2); ctx.lineTo(bracket3rdX, y3rdBottom + cellH / 2);
        ctx.moveTo(bracket3rdX, y3rdTop + cellH / 2); ctx.lineTo(bracket3rdX, y3rdBottom + cellH / 2);
        ctx.moveTo(bracket3rdX, y3rdCenter); ctx.lineTo(winner3rdX, y3rdCenter);
        ctx.stroke();

        drawSingleWinnerSlot(ctx, winner3rdX, winner3rdY, boxW, cellH, "3 место", match3rd, players, isCompact);
    }
}

/**
 * Расчёт позиций
 */
function positionMatchTreeProportional(match, rIdx, topY, height, roundsMap, roundNames, matchCoords, startX, colWidth, boxW, cellH, visibleRoundNames) {
    const currentRoundName = roundNames[rIdx];
    const visibleColIdx = visibleRoundNames.indexOf(currentRoundName);

    const actualColIdx = visibleColIdx !== -1 ? visibleColIdx : 0;
    const x = startX + actualColIdx * colWidth + (colWidth - boxW) / 2;

    const yTopCenter = topY + height * 0.25;
    const yCenter = topY + height * 0.50;
    const yBottomCenter = topY + height * 0.75;

    matchCoords[match.id] = {
        x: x,
        topSlotY: yTopCenter - cellH / 2,
        bottomSlotY: yBottomCenter - cellH / 2,
        topCenterY: yTopCenter,
        bottomCenterY: yBottomCenter,
        centerY: yCenter
    };

    if (rIdx > 0) {
        const prevRoundMatches = roundsMap[roundNames[rIdx - 1]];
        const currentRoundMatches = roundsMap[roundNames[rIdx]];
        const mIdx = currentRoundMatches.findIndex(m => m.id === match.id);

        const parent1 = prevRoundMatches[mIdx * 2];
        const parent2 = prevRoundMatches[mIdx * 2 + 1];

        if (parent1) {
            positionMatchTreeProportional(parent1, rIdx - 1, topY, height / 2, roundsMap, roundNames, matchCoords, startX, colWidth, boxW, cellH, visibleRoundNames);
        }
        if (parent2) {
            positionMatchTreeProportional(parent2, rIdx - 1, topY + height / 2, height / 2, roundsMap, roundNames, matchCoords, startX, colWidth, boxW, cellH, visibleRoundNames);
        }
    }
}

/**
 * Шаблон карточки боя
 */
function drawProportionalMatchTemplate(ctx, x, topY, bottomY, w, cellH, match, p1, p2, customHeader, isCompact = false) {
    const labelFont = isCompact ? 'bold 22px Arial' : 'bold 30px Arial';
    const headerFont = isCompact ? 'bold 20px Arial' : 'bold 28px Arial';

    // 1. Широ
    ctx.font = labelFont;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText("Широ", x, topY - 4);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, topY, w, cellH);
    drawSlotText(ctx, x, topY, w, cellH, p1, isCompact);

    // 2. "Бой № _____" ПОСЕРЕДИНЕ
    const gapCenterY = topY + cellH + (bottomY - (topY + cellH)) / 2;
    
    ctx.font = headerFont;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const headerTitle = customHeader || "Бой № _______";
    ctx.fillText(headerTitle, x + w / 2, gapCenterY);

    // 3. Ака
    ctx.font = labelFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText("Ака", x, bottomY - 4);

    ctx.strokeRect(x, bottomY, w, cellH);
    drawSlotText(ctx, x, bottomY, w, cellH, p2, isCompact);
}

/**
 * Слоты победителей
 */
function drawSingleWinnerSlot(ctx, x, y, w, h, labelTitle, match, players, isCompact = false) {
    ctx.font = isCompact ? 'bold 22px Arial' : 'bold 30px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(labelTitle, x, y - 4);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);

    const winnerPlayer = players.find(p => p.id === match.winner);
    drawSlotText(ctx, x, y, w, h, winnerPlayer, isCompact);
}

/**
 * Отрисовка данных бойца внутри слота
 */
function drawSlotText(ctx, x, y, w, h, player, isCompact = false) {
    if (!player) return;

    if (isCompact) {
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(player.name, x + w / 2, y + h * 0.48);

        ctx.font = '18px Arial';
        ctx.fillStyle = '#333333';
        const metaInfo = getPlayerMetaText(player);
        ctx.fillText(metaInfo, x + w / 2, y + h * 0.82);
    } else {
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(player.name, x + w / 2, y + h * 0.42);

        ctx.font = '28px Arial';
        ctx.fillStyle = '#333333';
        const metaInfo = getPlayerMetaText(player);
        ctx.fillText(metaInfo, x + w / 2, y + h * 0.78);
    }
}
