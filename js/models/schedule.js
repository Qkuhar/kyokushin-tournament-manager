export class Schedule {

    constructor() {
        this.fights = [];
    }

    addFight(fight) {
        this.fights.push(fight);
    }

    removeFight(id) {
        this.fights = this.fights.filter(
            f => f.id !== id
        );
    }

    move(oldIndex, newIndex) {
        const fight = this.fights.splice(oldIndex, 1)[0];
        this.fights.splice(newIndex, 0, fight);
    }

}