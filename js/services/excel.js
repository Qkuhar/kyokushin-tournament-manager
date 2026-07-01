// services/excel.js

import { Participant } from "../models/participant.js";
import { Tournament } from "../models/tournament.js";

export async function loadTournament(file) {

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer);

    const sheet = workbook.Sheets["participants"];

    if (!sheet) {
        throw new Error("Лист 'participants' не найден.");
    }

    const rows = XLSX.utils.sheet_to_json(sheet);

    const tournament = new Tournament();

    tournament.participants = rows.map(row => new Participant({

        id: Number(row["id"]),

        fio: row["ФИО"] ?? "",

        sex: Number(row["Пол"]),

        age: Number(row["Возраст"]),

        weight: parseFloat(
            String(row["Вес"]).replace(",", ".")
        ),

        city: row["Город"] ?? "",

        club: row["Клуб (Тренер)"] ?? "",

        belt: Number(row["Кю (Пояс)"])

    }));

    return tournament;

}