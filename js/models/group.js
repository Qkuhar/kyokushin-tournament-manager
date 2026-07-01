export class Group {

    constructor(id) {

        this.id = id;
        this.name = "";
        this.participants = [];

    }

    addParticipant(participant) {
        if (!this.participants.includes(participant)) {
            participant.groupId = this.id;
            this.participants.push(participant);

        }
    }

    removeParticipant(participantId) {
        this.participants = this.participants.filter(
            p => p.id !== participantId
        );
    }

    contains(participantId) {
        return this.participants.some(
            p => p.id === participantId
        );
    }

    get size() {
        return this.participants.length;
    }

}