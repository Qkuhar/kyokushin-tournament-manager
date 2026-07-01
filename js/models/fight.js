export class Fight {

    constructor(id) {
        this.id = id;
        this.groupId = null;
        this.aka = null;
        this.shiro = null;
        this.round = 1;
        this.mat = null;
        this.order = 0;
    }

    swap() {
        [this.aka, this.shiro] = [this.shiro, this.aka];
    }

    hasParticipant(id) {
        return this.aka?.id === id ||
               this.shiro?.id === id;
    }

    get participants() {
        return [this.aka, this.shiro].filter(Boolean);
    }

}