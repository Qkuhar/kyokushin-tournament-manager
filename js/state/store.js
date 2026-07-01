import { Tournament } from "../models/tournament.js";

class Store {

    constructor() {
        this.reset();
    }

    reset() {
        this.tournament = new Tournament();
    }

    loadTournament(tournament) {
        this.tournament = tournament;
    }

    get participants() {
        return this.tournament.participants;
    }

    get groups() {
        return this.tournament.groups;
    }

    get fights() {
        return this.tournament.fights;
    }

    get schedule() {
        return this.tournament.schedule;
    }

}

export const store = new Store();