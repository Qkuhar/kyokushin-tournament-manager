// views/participantsView.js

import { createDragDrop } from "../components/dragdrop.js";
import { loadTournament } from "../services/excel.js";
import { store } from "../state/store.js";

export function renderParticipants(container) {

    container.innerHTML = `

        <h1>Participants</h1>

        <div id="drop-zone">

            <p>Drop Excel file here</p>

            <button id="open-file">
                Open Excel
            </button>

            <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                hidden>

        </div>

        <br>

        <div id="participants-table"></div>

    `;

    createDragDrop(
        document.getElementById("drop-zone"),
        async (file) => {

            try {

                const tournament = await loadTournament(file);

                store.loadTournament(tournament);

                renderTable();

            }
            catch (e) {

                alert(e.message);

                console.error(e);

            }

        }
    );

    renderTable();
}

function renderTable() {

    const table = document.getElementById("participants-table");

    if (!table)
        return;

    if (store.participants.length === 0) {

        table.innerHTML = "<p>No participants loaded.</p>";

        return;

    }

    table.innerHTML = `

        <table border="1" cellspacing="0" cellpadding="5">

            <thead>

                <tr>

                    <th>ID</th>
                    <th>ФИО</th>
                    <th>Пол</th>
                    <th>Возраст</th>
                    <th>Вес</th>
                    <th>Город</th>
                    <th>Клуб</th>
                    <th>Кю</th>

                </tr>

            </thead>

            <tbody>

                ${store.participants.map(p => `

                    <tr>

                        <td>${p.id}</td>
                        <td>${p.fio}</td>
                        <td>${p.sex}</td>
                        <td>${p.age}</td>
                        <td>${p.weight}</td>
                        <td>${p.city}</td>
                        <td>${p.club}</td>
                        <td>${p.belt}</td>

                    </tr>

                `).join("")}

            </tbody>

        </table>

    `;

}