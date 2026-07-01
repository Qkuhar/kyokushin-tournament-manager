export class Participant {

    constructor(data = {}) {

        this.id = data.id ?? 0;
        this.fio = data.fio ?? "NO NAME!";
        this.sex = data.sex ?? 0;
        this.age = data.age ?? 0;
        this.weight = data.weight ?? 0;
        this.city = data.city ?? "NO CITY!";
        this.club = data.club ?? "NO CLUB!";
        this.belt = data.belt ?? 0;
        this.groupId = null;
    }

    get fullName() {
        return this.fio;
    }

    get isMale() {
        return this.sex === 1;
    }

    get isFemale() {
        return this.sex === 2;
    }

    clone() {
        return new Participant(structuredClone(this));
    }

}